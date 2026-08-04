#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "json"

ROOT = File.expand_path("..", __dir__)
ARCHIVE = File.join(ROOT, "data", "artwork-archive.json")
CATALOGUE = File.join(ROOT, "data", "catalogue-raisonne-master.json")
WEBSITE = File.join(ROOT, "data", "artworks.js")
CSV_EXPORT = File.join(ROOT, "data", "artwork-archive.csv")
REPORT = File.join(ROOT, "data", "artwork-archive-report.md")

def fail_with(errors)
  warn "Archive validation failed:\n- #{errors.join("\n- ")}"
  exit 1
end

paths = [ARCHIVE, CATALOGUE, WEBSITE, CSV_EXPORT, REPORT]
missing_paths = paths.reject { |path| File.file?(path) }
fail_with(missing_paths.map { |path| "missing #{path}" }) unless missing_paths.empty?

archive = JSON.parse(File.read(ARCHIVE))
catalogue = JSON.parse(File.read(CATALOGUE))
website_source = File.read(WEBSITE)
website_json = website_source.sub(/\A\s*window\.CHER_WANG_ARTWORKS\s*=\s*/, "").sub(/;\s*\z/, "")
website = JSON.parse(website_json)
csv = CSV.read(CSV_EXPORT, headers: true)
report = File.read(REPORT)
artworks = archive.fetch("artworks")
errors = []

def index_by_id(records)
  records.to_h { |record| [record.fetch("artworkId"), record] }
end

archive_index = index_by_id(artworks)
catalogue_index = index_by_id(catalogue.fetch("artworks"))
website_index = index_by_id(website)
errors << "catalogue and archive artwork IDs differ" unless catalogue_index.keys.sort == archive_index.keys.sort
website_only_ids = website_index.keys - archive_index.keys
errors << "website contains records absent from archive: #{website_only_ids.join(", ")}" unless website_only_ids.empty?
archive_index.each do |id, record|
  errors << "#{id}: catalogue and archive fields differ" unless catalogue_index[id] == record
end
website_index.each do |id, record|
  archive_record = archive_index.fetch(id)
  shared_fields = record.keys - ["image"]
  different = shared_fields.select { |field| record[field] != archive_record[field] }
  errors << "#{id}: website/archive content differs in #{different.join(", ")}" unless different.empty?
end

expected_count = archive.fetch("summary").fetch("totalWebsiteArtworks")
errors << "archive summary count mismatch" unless expected_count == artworks.length
errors << "catalogue summary count mismatch" unless catalogue.fetch("summary").fetch("totalWebsiteArtworks") == artworks.length
errors << "CSV row count mismatch" unless csv.length == artworks.length
errors << "report record count mismatch" unless report.include?("Artwork records read: #{artworks.length}")

ids = artworks.map { |record| record.fetch("artworkId") }
errors << "artwork IDs are not unique" unless ids.uniq.length == ids.length

missing_section = report[/## Missing fields hidden from the public website\s*(.*?)(?=\n## |\z)/m].to_s
documented_missing = missing_section.lines.each_with_object({}) do |line, index|
  next unless line.strip =~ /\A-\s+(KXW-[^:]+):\s*(.+)\z/

  index[Regexp.last_match(1)] = Regexp.last_match(2).split(",").map(&:strip)
end
always_required = %w[artworkId titleZh titleEn category image statementZh statementEn fullRecordText]
metadata_required = %w[year medium dimensions series]
placeholder = /\A(?:\||Year|Medium|Size|Series|undefined|null)\z/i
forbidden = /待核验|待补充|未确认|undefined/i
statement_like_series = /作品|画面|创作|描绘|源于|painting|depicts|created|inspired/i

artworks.each do |record|
  id = record.fetch("artworkId", "unknown")
  always_required.each do |field|
    value = record.fetch(field, "").to_s.strip
    errors << "#{id}: missing #{field}" if value.empty?
    errors << "#{id}: placeholder in #{field}" if value.match?(placeholder)
  end
  metadata_required.each do |field|
    value = record.fetch(field, "").to_s.strip
    if value.empty?
      errors << "#{id}: undocumented missing #{field}" unless documented_missing.fetch(id, []).include?(field)
    elsif value.match?(placeholder)
      errors << "#{id}: placeholder in #{field}"
    end
  end
  record.each do |field, value|
    errors << "#{id}: forbidden token in #{field}" if value.to_s.match?(forbidden)
  end
  series = record.fetch("series", "").to_s
  errors << "#{id}: statement appears in series" if series.length > 140 || series.match?(statement_like_series)
  errors << "#{id}: title/series field collision" if series == record.fetch("statementZh", "") || series == record.fetch("statementEn", "")
  image = File.join(ROOT, record.fetch("image", ""))
  errors << "#{id}: missing image #{record.fetch("image", "")}" unless File.file?(image)
  full = record.fetch("fullRecordText", "")
  %w[titleZh titleEn year medium dimensions].each do |field|
    next if record.fetch(field, "").to_s.empty?

    errors << "#{id}: full record does not contain #{field}" unless full.include?(record.fetch(field).to_s)
  end
end
website.each do |record|
  image = File.join(ROOT, record.fetch("image", ""))
  errors << "#{record.fetch("artworkId")}: missing website image #{record.fetch("image", "")}" unless File.file?(image)
end

csv_headers = %w[artworkId titleZh titleEn year medium dimensions series category image sourceFile]
errors << "CSV headers do not match formal catalogue schema" unless csv.headers == csv_headers
csv_by_id = csv.each_with_object({}) { |row, index| index[row.fetch("artworkId")] = row }
artworks.each do |record|
  row = csv_by_id[record.fetch("artworkId")]
  if row.nil?
    errors << "#{record.fetch("artworkId")}: missing CSV row"
    next
  end
  csv_headers.each do |field|
    errors << "#{record.fetch("artworkId")}: CSV #{field} mismatch" unless row.fetch(field, "").to_s == record.fetch(field, "").to_s
  end
end

by_id = artworks.to_h { |record| [record.fetch("artworkId"), record] }
assertions = {
  "KXW-W-001" => { "titleZh" => "《和平静域》", "titleEn" => "Realm of Stillness", "year" => "2023" },
  "KXW-W-023" => { "titleZh" => "《痕迹》", "year" => "2022" },
  "KXW-W-004" => { "titleZh" => "《绿野清风》", "year" => "2025" },
  "KXW-W-022" => { "year" => "2022", "medium" => "纸本水彩 / Watercolor on paper", "dimensions" => "76 × 103 cm" },
  "KXW-W-034" => { "titleEn" => "Qianhai Construction Log: The First Pile", "dimensions" => "83 × 110 cm" },
  "KXW-W-035" => { "titleEn" => "A Symphony of the Mountains", "dimensions" => "79 × 112 cm" }
}
assertions.each do |id, fields|
  record = by_id[id]
  if record.nil?
    errors << "missing required audited artwork #{id}"
    next
  end
  fields.each { |field, expected| errors << "#{id}: expected #{field}=#{expected.inspect}" unless record.fetch(field, "") == expected }
end

harbor = by_id.fetch("KXW-W-018", {})
expected_award = "Juror's Commendation Award, Northwest Watercolor Society 81st Annual International Open Exhibition, 2021."
errors << "KXW-W-018: official NWWS award name missing" unless harbor.fetch("awards", "").include?(expected_award)
errors << "KXW-W-018: obsolete Materials Award remains" if harbor.fetch("awards", "").match?(/Materials Award|材料奖/i)
errors << "KXW-W-018: sheet/image dimensions or pending measurement note missing" unless harbor.fetch("dimensions", "").include?("纸张 76 × 103 cm") && harbor.fetch("dimensions", "").include?("画面约 69 × 103 cm") && harbor.fetch("dimensions", "").include?("待精测")

fail_with(errors) unless errors.empty?

puts "Archive validation passed"
puts "records=#{artworks.length}"
puts "images=#{artworks.length}"
puts "csv_rows=#{csv.length}"
puts "catalogue_archive_website_consistent=true"
puts "website_records=#{website.length}"
puts "archive_only_records=#{(archive_index.keys - website_index.keys).length}"
puts "forbidden_placeholders=0"
puts "statement_series_collisions=0"
puts "documented_missing_fields=#{documented_missing.values.sum(&:length)}"
