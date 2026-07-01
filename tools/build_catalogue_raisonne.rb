#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "open3"
require "tempfile"

ROOT = File.expand_path("..", __dir__)
CATALOGUE_DIR = Dir[File.join("/Volumes", "Cher", "*作品总目录*")].first
IMAGE_DIR = File.join(ROOT, "assets", "images", "catalogue-raisonne")
MASTER_JSON = File.join(ROOT, "data", "artwork-archive.json")
CATALOGUE_JSON = File.join(ROOT, "data", "catalogue-raisonne-master.json")
WEBSITE_JS = File.join(ROOT, "data", "artworks.js")
CSV_EXPORT = File.join(ROOT, "data", "artwork-archive.csv")
ARCHIVE_REPORT = File.join(ROOT, "data", "artwork-archive-report.md")
REPORT = File.join(ROOT, "data", "catalogue-raisonne-confirmation-report.md")
DUPLICATE_SOURCE_FILES = [
  "副本KXW-049_夜色匆匆_Artwork_Record_Updated.docx"
].freeze

FIELD_LABELS = {
  artworkId: [
    /Artwork ID\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /作品编号[：:]\s*(.+)/
  ],
  titleZh: [
    /Title\s*\(CN\)\s*(?:\/[^\n：:]*)?[：:]\s*《?(.+?)》?\s*$/i,
    /中文名称[：:]\s*《?(.+?)》?\s*$/,
    /作品名称\s*[|｜]\s*Title[：:]?\s*《(.+?)》?\s*$/,
    /作品名称[：:]\s*《?(.+?)》?\s*$/
  ],
  titleEn: [
    /Title\s*\(EN\)\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /English Title[：:]\s*(.+)/i
  ],
  year: [
    /Year\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /创作(?:年代|年份)\s*[|｜]?\s*(?:Year)?[：:]?\s*(.+)/
  ],
  medium: [
    /Medium\s*(?:\([^)]*\))?\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /Medium\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /材(?:料|质)\s*[|｜]?\s*(?:Medium)?[：:]?\s*(.+)/,
    /媒介\s*(?:（Medium）|\(Medium\))?[：:]?\s*(.+)/
  ],
  dimensions: [
    /Dimensions\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /尺寸\s*[|｜]?\s*(?:Dimensions|Size)?[：:]?\s*(.+)/i,
    /尺寸\s*(?:（Dimensions）|\(Dimensions\)|Size)?[：:]?\s*(.+)/i
  ],
  series: [
    /Series\s*(?:\([^)]*\))?\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /Series\s*(?:\/[^\n：:]*)?[：:]\s*(.+)/i,
    /系列\s*[|｜]?\s*(?:Series)?[：:]?\s*(.+)/i,
    /系列\s*(?:（Series）|\(Series\))?[：:]?\s*(.+)/i
  ]
}.freeze

SECTION_STARTS = {
  keywords: [/^Keywords\b/i, /^关键词\b/],
  statementZh: [/Artwork Statement.*(?:CN|中文)/i, /^作品(?:阐述|说明|介绍).*中文/, /^中文$/],
  statementEn: [/Artwork Statement.*(?:EN|English)/i, /^Artist Statement.*English/i, /^Description.*English/i, /^English$/],
  exhibitions: [/Exhibition/i, /展览经历/, /Academic Achievements/i, /学术成果/],
  awards: [/Awards/i, /获奖/],
  collection: [/Collections?/i, /收藏/],
  publication: [/Publications?/i, /出版/]
}.freeze

SECTION_BOUNDARY = [
  /^Keywords\b/i,
  /^关键词\b/,
  /Artwork Statement/i,
  /Artist Statement/i,
  /^作品(?:阐述|说明)/,
  /^中文$/,
  /^English$/,
  /Exhibition/i,
  /展览经历/,
  /Academic Achievements/i,
  /学术成果/,
  /Awards/i,
  /获奖/,
  /Collections?/i,
  /收藏/,
  /Publications?/i,
  /出版/
].freeze

def run_command(*args)
  stdout, stderr, status = Open3.capture3(*args)
  raise "#{args.join(" ")} failed: #{stderr}" unless status.success?

  stdout
end

def docx_text(path)
  run_command("textutil", "-convert", "txt", "-stdout", path)
    .gsub("\r\n", "\n")
    .gsub("\r", "\n")
    .gsub("\u2028", "\n")
    .lines
    .map(&:rstrip)
    .join("\n")
    .gsub(/\n{3,}/, "\n\n")
    .strip
end

def zip_media_entries(path)
  listing = run_command("unzip", "-l", path)
  entries = []
  listing.lines.each do |line|
    next unless line.include?("word/media/")
    next unless line =~ /(word\/media\/\S+\.(?:jpe?g|png|webp|tiff?))\b/i

    entries << Regexp.last_match(1)
  end
  entries
end

def split_series(series)
  parts = series.to_s.split(" / ", 2).map(&:strip)
  [parts[0].to_s, parts[1].to_s]
end

def append_record_section(lines, label, value)
  value = value.to_s.strip
  return if value.empty?

  lines << label
  lines << value
end

def canonical_full_record(record)
  series_zh, series_en = split_series(record["series"])
  lines = [
    "Artwork Record / 作品档案",
    "Artwork ID: #{record["artworkId"]}",
    "Title (CN): #{record["titleZh"]}",
    "Title (EN): #{record["titleEn"]}",
    "Year: #{record["year"]}",
    "Medium: #{record["medium"]}",
    "Dimensions: #{record["dimensions"]}",
    "Series (CN): #{series_zh}",
    "Series (EN): #{series_en}"
  ]
  append_record_section(lines, "Artwork Statement (CN)", record["statementZh"])
  append_record_section(lines, "Artwork Statement (EN)", record["statementEn"])
  append_record_section(lines, "Keywords / 关键词", record["keywords"])
  append_record_section(lines, "Exhibition History / 展览经历", record["exhibitionHistory"])
  append_record_section(lines, "Awards / 荣誉", record["awards"])
  append_record_section(lines, "Collection / 收藏", record["collection"])
  append_record_section(lines, "Publication / 出版发表", record["publication"])
  lines.join("\n")
end

def extract_media(path, entry, destination)
  data = run_command("unzip", "-p", path, entry)
  Tempfile.create(["catalogue-source", File.extname(entry)]) do |tempfile|
    tempfile.binmode
    tempfile.write(data)
    tempfile.close

    _stdout, _stderr, status = Open3.capture3(
      "sips",
      "-s", "format", "jpeg",
      "-s", "formatOptions", "82",
      "--resampleHeightWidthMax", "2000",
      tempfile.path,
      "--out", destination
    )

    File.binwrite(destination, data) unless status.success?
  end
end

def clean_value(value)
  value.to_s.strip.sub(/\A[:：]\s*/, "").sub(/\A《/, "").sub(/》\z/, "").strip
end

def meaningful_value?(value)
  text = clean_value(value)
  return false if text.empty?

  label_only = /\A(?:作品名称|Title|创作年代|创作年份|Year|材质|材料|媒介|Medium|尺寸|Dimensions|Size|系列|Series|编号|Catalogue No\.?|Artwork No\.?)(?:\s*[|｜\/]\s*(?:Title|Year|Medium|Dimensions|Size|Series))?\z/i
  return false if text =~ label_only
  return false if text =~ /\A[（(](?:Year|Medium|Dimensions|Size|Series)[）)]\z/i

  true
end

def first_match(text, patterns)
  patterns.each do |pattern|
    text.each_line do |line|
      next unless line.strip =~ pattern

      value = clean_value(Regexp.last_match(1))
      return value unless value.empty?
    end
  end
  nil
end

def filename_number(filename)
  return Regexp.last_match(1) if filename =~ /KXW[-_](\d{3})/i
  return Regexp.last_match(1).rjust(3, "0") if filename =~ /No\.?\s*(\d{1,3})/i
  return Regexp.last_match(1).rjust(3, "0") if filename =~ /第\s*(\d{1,3})\s*幅/
  return Regexp.last_match(1).rjust(3, "0") if filename =~ /第(\d{1,3})/

  nil
end

def fallback_id(filename)
  number = filename_number(filename)
  number ? "KXW-#{number}" : nil
end

def title_pair_from_line(value)
  text = value.to_s.strip
  return [nil, nil] if text.empty?

  if text =~ /《(.+?)》\s*\/\s*(.+)\z/
    [Regexp.last_match(1).strip, Regexp.last_match(2).strip]
  elsif text =~ /(.+?)》\s*\/\s*(.+)\z/
    [clean_value(Regexp.last_match(1)), Regexp.last_match(2).strip]
  elsif text =~ /(.+?)\s*\/\s*(.+)\z/
    [clean_value(Regexp.last_match(1)), clean_value(Regexp.last_match(2))]
  else
    [clean_value(text), nil]
  end
end

def first_title_pair(text)
  lines = text.lines.map(&:strip).reject(&:empty?)
  lines.each_with_index do |line, index|
    next unless line.include?("《") && line.include?("》")

    zh, en = title_pair_from_line(line)
    en ||= clean_value(lines[(index + 1)..].to_a.find { |candidate| candidate !~ /^(创作|Year|材|Medium|尺寸|Dimensions|系列|Series)/i })
    return [zh, en]
  end
  [nil, nil]
end

def labeled_value(text, label_patterns)
  lines = text.lines.map(&:strip)
  lines.each_with_index do |line, index|
    label_patterns.each do |pattern|
      next unless line =~ pattern

      remainder = line.sub(pattern, "")
        .sub(/\A\s*(?:[|｜\/]\s*)?(?:Title|Year|Medium|Dimensions|Size|Series|Catalogue No\.?|Artwork No\.?)?\s*/i, "")
        .sub(/\A\s*[：:]\s*/, "")
        .strip
      return clean_value(remainder) if meaningful_value?(remainder)

      ((index + 1)...lines.length).each do |cursor|
        candidate = lines[cursor]
        next if candidate.empty? || candidate.start_with?("⸻")
        return clean_value(candidate) if meaningful_value?(candidate)
      end
    end
  end
  nil
end

def title_from_labeled_lines(text)
  value = labeled_value(text, [
    /\A作品名称\s*(?:[|｜]\s*Title|Title)?/i,
    /\A第\d+\s*幅作品名/,
    /\ATitle\b/i
  ])
  title_pair_from_line(value)
end

def clean_title(value)
  clean_value(value)
    .sub(/\A第\d+\s*幅作品名\s*[：:]\s*/, "")
    .sub(/\A作品名称\s*(?:[|｜]\s*Title|Title)?\s*[：:]?\s*/, "")
    .sub(/\ATitle\s*[：:]?\s*/i, "")
    .sub(/\A《/, "")
    .sub(/》\z/, "")
    .strip
end

def clean_display_value(value)
  text = clean_value(value)
  3.times do
    text = text
      .sub(/\A(?:Year|创作年代|创作年份)\s*(?:[|｜\/]\s*(?:Year|创作年代|创作年份))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Dimensions|Size|尺寸)\s*(?:[|｜\/]\s*(?:Dimensions|Size|尺寸))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Medium|材质|材料|媒介)\s*(?:[|｜\/]\s*(?:Medium|材质|材料|媒介))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Series|系列)\s*(?:[|｜\/]\s*(?:Series|系列))?\s*[：:]?\s*/i, "")
      .sub(/\A[|｜\/]\s*/, "")
      .strip
  end
  text
end

def explicit_pair(text, field)
  cn_pattern = /^#{field}\s*\(CN\)\s*[：:]\s*(.+)/i
  en_pattern = /^#{field}\s*\(EN\)\s*[：:]\s*(.+)/i
  cn = first_match(text, [cn_pattern])
  en = first_match(text, [en_pattern])
  return nil if cn.to_s.empty? && en.to_s.empty?
  return cn if en.to_s.empty?
  return en if cn.to_s.empty?

  "#{cn} / #{en}"
end

def next_nonempty_after_label(text, label_patterns)
  lines = text.lines.map(&:strip)
  lines.each_with_index do |line, index|
    next unless label_patterns.any? { |pattern| line =~ pattern }

    ((index + 1)...lines.length).each do |cursor|
      value = clean_value(lines[cursor])
      return value unless value.empty?
    end
  end
  nil
end

def section_text(text, start_patterns)
  lines = text.lines.map(&:rstrip)
  start_index = lines.index { |line| start_patterns.any? { |pattern| line.strip =~ pattern } }
  return "" unless start_index

  collected = []
  lines[(start_index + 1)..].to_a.each do |line|
    stripped = line.strip
    break if !collected.empty? && SECTION_BOUNDARY.any? { |pattern| stripped =~ pattern }

    collected << line
  end
  collected.join("\n").strip
end

def artwork_statement_pair(text)
  block = section_text(text, [
    /^作品(?:阐述|说明|介绍)\s*[|｜]\s*Artwork Statement/i,
    /^Artwork Statement\s*[|｜]\s*作品(?:阐述|说明|介绍)/i
  ])
  return ["", ""] if block.empty?

  zh_lines = []
  en_lines = []
  current = nil
  block.lines.each do |line|
    stripped = line.strip
    if stripped =~ /\A中文\s*[：:]\s*(.*)\z/
      current = :zh
      value = Regexp.last_match(1).strip
      zh_lines << value unless value.empty?
      next
    end
    if stripped =~ /\AEnglish\s*[：:]\s*(.*)\z/i
      current = :en
      value = Regexp.last_match(1).strip
      en_lines << value unless value.empty?
      next
    end

    zh_lines << line if current == :zh
    en_lines << line if current == :en
  end

  [zh_lines.join("\n").strip, en_lines.join("\n").strip]
end

def category_from_medium(medium)
  text = medium.to_s.downcase
  return "oil" if text.include?("oil") || medium.to_s.include?("油画")
  return "printmaking" if text.include?("print") || medium.to_s.include?("版画") || medium.to_s.include?("木刻")
  return "watercolor" if text.include?("watercolor") || medium.to_s.include?("水彩") || text.include?("gouache") || medium.to_s.include?("水粉") || text.include?("pastel") || medium.to_s.include?("色粉")

  "watercolor"
end

def js_string(data)
  JSON.pretty_generate(data, ensure_ascii: false)
end

raise "Catalogue folder not found" unless CATALOGUE_DIR && Dir.exist?(CATALOGUE_DIR)

FileUtils.rm_rf(IMAGE_DIR)
FileUtils.mkdir_p(IMAGE_DIR)

docx_files = Dir[File.join(CATALOGUE_DIR, "*.docx")]
  .reject { |path| File.basename(path).start_with?("._") }
  .reject { |path| File.basename(path).include?("Series_Master") || File.basename(path).include?("Series Master") }
  .reject { |path| DUPLICATE_SOURCE_FILES.include?(File.basename(path)) }
  .sort_by { |path| [filename_number(File.basename(path)).to_i, File.basename(path)] }

records = []
issues = []
used_archive_ids = Hash.new(0)

docx_files.each_with_index do |path, index|
  filename = File.basename(path)
  text = docx_text(path)
  media_entries = zip_media_entries(path)
  source_id = first_match(text, FIELD_LABELS.fetch(:artworkId))
  archive_id = source_id || fallback_id(filename) || "CAT-#{(index + 1).to_s.rjust(3, "0")}"

  paired_title_zh, paired_title_en = first_title_pair(text)
  labeled_title_zh, labeled_title_en = title_from_labeled_lines(text)
  title_line_value = first_match(text, [/^Title[：:]\s*(.+)/i, /^作品名称\s*Title\s*$/i])
  title_line_zh, title_line_en = title_pair_from_line(title_line_value)

  title_zh = first_match(text, FIELD_LABELS.fetch(:titleZh)) ||
    labeled_title_zh ||
    paired_title_zh ||
    title_line_zh ||
    next_nonempty_after_label(text, [/作品名称\s*[|｜]?\s*Title/i, /^Title$/i])
  title_en = first_match(text, FIELD_LABELS.fetch(:titleEn))
  title_en ||= labeled_title_en || paired_title_en || title_line_en || begin
    title_label_value = next_nonempty_after_label(text, [/作品名称\s*[|｜]\s*Title/i, /^Title$/i])
    lines = text.lines.map(&:strip)
    idx = lines.index { |line| line =~ /作品名称\s*[|｜]?\s*Title/i || line =~ /^Title$/i }
    idx ? clean_value(lines[(idx + 2)..].to_a.find { |line| !line.empty? }) : title_label_value
  end

  title_zh = clean_title(title_zh)
  title_en = clean_title(title_en)
  split_title_zh, split_title_en = title_pair_from_line(title_zh)
  if split_title_en
    title_zh = clean_title(split_title_zh)
    title_en = clean_title(split_title_en) if title_en.to_s.empty? || title_en == title_zh
  end

  year = labeled_value(text, [/\A创作(?:年代|年份)\s*(?:[|｜]?\s*Year|（Year）|\(Year\)|Year)?/i, /\AYear\b/i]) || first_match(text, FIELD_LABELS.fetch(:year))
  medium = explicit_pair(text, "Medium") || labeled_value(text, [/\A材(?:料|质)\s*(?:[|｜]?\s*Medium|（Medium）|\(Medium\)|Medium)?/i, /\A媒介\s*(?:（Medium）|\(Medium\)|Medium)?/i, /\AMedium\b/i]) || first_match(text, FIELD_LABELS.fetch(:medium))
  dimensions = labeled_value(text, [/\A尺寸\s*(?:[|｜]?\s*(?:Dimensions|Size)|（Dimensions）|\(Dimensions\)|Dimensions|Size)?/i, /\ADimensions\b/i, /\ASize\b/i]) || first_match(text, FIELD_LABELS.fetch(:dimensions))
  series = explicit_pair(text, "Series") || labeled_value(text, [/\A系列\s*(?:[|｜]?\s*Series|（Series）|\(Series\)|Series)?/i, /\ASeries\b/i]) || first_match(text, FIELD_LABELS.fetch(:series))

  year = clean_display_value(year)
  medium = clean_display_value(medium)
  dimensions = clean_display_value(dimensions)
  series = clean_display_value(series)
  paired_statement_zh, paired_statement_en = artwork_statement_pair(text)

  used_archive_ids[archive_id] += 1
  if used_archive_ids[archive_id] > 1
    suffix = clean_title(title_zh).gsub(/[^A-Za-z0-9\u4e00-\u9fff]+/, "-").gsub(/\A-|-+\z/, "")
    suffix = File.basename(filename, ".docx").gsub(/[^A-Za-z0-9\u4e00-\u9fff]+/, "-").gsub(/\A-|-+\z/, "") if suffix.empty?
    archive_id = "#{archive_id}-#{suffix}"
    used_archive_ids[archive_id] += 1
  end

  if media_entries.length != 1
    issues << {
      "type" => "image_match_uncertain",
      "archiveId" => archive_id,
      "file" => filename,
      "message" => "Expected exactly one embedded image, found #{media_entries.length}."
    }
  end

  image_path = ""
  if media_entries.length == 1
    image_filename = "#{archive_id.gsub(/[^A-Za-z0-9-]/, "-")}.jpg"
    image_path = File.join("assets", "images", "catalogue-raisonne", image_filename)
    extract_media(path, media_entries.first, File.join(ROOT, image_path))
  end

  missing = []
  {
    "artworkId" => archive_id,
    "titleZh" => title_zh,
    "titleEn" => title_en,
    "year" => year,
    "medium" => medium,
    "dimensions" => dimensions,
    "series" => series
  }.each do |field, value|
    missing << field if value.to_s.strip.empty?
  end
  missing << "image" if image_path.empty?

  missing.each do |field|
    issues << {
      "type" => "missing_or_unparsed_metadata",
      "archiveId" => archive_id,
      "file" => filename,
      "field" => field,
      "message" => "#{field} could not be read with certainty."
    }
  end

  record = {
    "artworkId" => archive_id,
    "sourceArtworkId" => source_id.to_s,
    "sourceFile" => filename,
    "sourcePath" => path,
    "image" => image_path,
    "category" => category_from_medium(medium),
    "titleZh" => title_zh.to_s,
    "titleEn" => title_en.to_s,
    "year" => year.to_s,
    "medium" => medium.to_s,
    "dimensions" => dimensions.to_s,
    "series" => series.to_s,
    "keywords" => section_text(text, SECTION_STARTS.fetch(:keywords)),
    "statementZh" => section_text(text, SECTION_STARTS.fetch(:statementZh)).then { |value| value.empty? ? paired_statement_zh : value },
    "statementEn" => section_text(text, SECTION_STARTS.fetch(:statementEn)).then { |value| value.empty? ? paired_statement_en : value },
    "exhibitionHistory" => section_text(text, SECTION_STARTS.fetch(:exhibitions)),
    "awards" => section_text(text, SECTION_STARTS.fetch(:awards)),
    "collection" => section_text(text, SECTION_STARTS.fetch(:collection)),
    "publication" => section_text(text, SECTION_STARTS.fetch(:publication))
  }
  record["fullRecordText"] = canonical_full_record(record)
  records << record
end

duplicate_groups = records.group_by do |record|
  [record["titleZh"], record["titleEn"], record["year"], record["dimensions"]].map(&:to_s).map(&:strip).join("||")
end.values.select { |group| group.length > 1 }

duplicate_groups.each do |group|
  issues << {
    "type" => "possible_duplicate_in_catalogue",
    "archiveIds" => group.map { |record| record["artworkId"] },
    "files" => group.map { |record| record["sourceFile"] },
    "message" => "Multiple catalogue records share title/year/dimensions."
  }
end

master = {
  "schemaVersion" => "2.0",
  "source" => CATALOGUE_DIR,
  "recordCount" => records.length,
  "rules" => [
    "Catalogue raisonne records are the official source of truth.",
    "Metadata is copied from the Word records and should not be invented.",
    "Each artwork image is extracted from the matching Word record."
  ],
  "issues" => issues,
  "artworks" => records
}

website_records = records.map do |record|
  {
    "artworkId" => record["artworkId"],
    "titleZh" => record["titleZh"],
    "titleEn" => record["titleEn"],
    "year" => record["year"],
    "medium" => record["medium"],
    "dimensions" => record["dimensions"],
    "series" => record["series"],
    "category" => record["category"],
    "image" => record["image"],
    "keywords" => record["keywords"],
    "statementZh" => record["statementZh"],
    "statementEn" => record["statementEn"],
    "exhibitionHistory" => record["exhibitionHistory"],
    "awards" => record["awards"],
    "collection" => record["collection"],
    "publication" => record["publication"],
    "fullRecordText" => record["fullRecordText"],
    "sourceFile" => record["sourceFile"]
  }
end

File.write(MASTER_JSON, JSON.pretty_generate(master, ensure_ascii: false) + "\n")
File.write(CATALOGUE_JSON, JSON.pretty_generate(master, ensure_ascii: false) + "\n")
File.write(WEBSITE_JS, "window.CHER_WANG_ARTWORKS = #{js_string(website_records)};\n")
File.write(CSV_EXPORT, [
  %w[artworkId titleZh titleEn year medium dimensions series category image sourceFile].join(","),
  *records.map do |record|
    [
      record["artworkId"],
      record["titleZh"],
      record["titleEn"],
      record["year"],
      record["medium"],
      record["dimensions"],
      record["series"],
      record["category"],
      record["image"],
      record["sourceFile"]
    ].map { |value| "\"#{value.to_s.gsub("\"", "\"\"")}\"" }.join(",")
  end
].join("\n") + "\n")

report_lines = [
  "# Catalogue Raisonné Confirmation Report",
  "",
  "Source folder: `#{CATALOGUE_DIR}`",
  "",
  "- Artwork records read: #{records.length}",
  "- Embedded images matched: #{records.count { |record| !record["image"].empty? }}",
  "- Issues requiring confirmation: #{issues.length}",
  ""
]

if issues.empty?
  report_lines << "No conflicts or missing data were detected."
else
  issues.each do |issue|
    report_lines << "- #{issue["type"]}: #{issue["archiveId"] || issue["archiveIds"]} — #{issue["message"]} File: #{issue["file"] || issue["files"]}"
  end
end

File.write(REPORT, report_lines.join("\n") + "\n")
File.write(ARCHIVE_REPORT, report_lines.join("\n") + "\n")

puts "Read #{records.length} artwork records"
puts "Matched #{records.count { |record| !record["image"].empty? }} embedded images"
puts "Wrote #{MASTER_JSON}"
puts "Wrote #{CATALOGUE_JSON}"
puts "Wrote #{WEBSITE_JS}"
puts "Wrote #{CSV_EXPORT}"
puts "Wrote #{REPORT}"
puts "Issues: #{issues.length}"
