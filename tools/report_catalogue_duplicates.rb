#!/usr/bin/env ruby
# frozen_string_literal: true

require "digest"
require "open3"

ROOT = File.expand_path("..", __dir__)
CATALOGUE_DIR = Dir[File.join("/Volumes", "Cher", "*作品总目录*")].first
REPORT = File.join(ROOT, "data", "catalogue-duplicate-report.md")

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
  ]
}.freeze

raise "Catalogue folder not found" unless CATALOGUE_DIR && Dir.exist?(CATALOGUE_DIR)

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

def media_hash(path)
  entry = zip_media_entries(path).first
  return "" unless entry

  Digest::SHA256.hexdigest(run_command("unzip", "-p", path, entry))
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
    en ||= clean_value(lines[(index + 1)..-1].to_a.find { |candidate| candidate !~ /^(创作|Year|材|Medium|尺寸|Dimensions|系列|Series)/i })
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
    /\ATitle\b(?!\s*\((?:CN|EN)\))/i
  ])
  title_pair_from_line(value)
end

def clean_title(value)
  clean_value(value)
    .sub(/\A第\d+\s*幅作品名\s*[：:]\s*/, "")
    .sub(/\A作品名称\s*(?:[|｜]\s*Title|Title)?\s*[：:]?\s*/, "")
    .sub(/\A(?:中文名称|English Title)\s*[：:]?\s*/i, "")
    .sub(/\ATitle\s*(?:\((?:CN|EN)\))?\s*[：:]?\s*/i, "")
    .sub(/\A《/, "")
    .sub(/》\z/, "")
    .strip
end

def clean_display_value(value)
  text = clean_value(value)
  3.times do
    text = text
      .sub(/\A(?:Artwork ID|作品编号)\s*(?:[|｜\/]\s*(?:Artwork ID|作品编号))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Year|创作年代|创作年份)\s*(?:[|｜\/]\s*(?:Year|创作年代|创作年份))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Dimensions|Size|尺寸)\s*(?:[|｜\/]\s*(?:Dimensions|Size|尺寸))?\s*[：:]?\s*/i, "")
      .sub(/\A(?:Medium|材质|材料|媒介)\s*(?:[|｜\/]\s*(?:Medium|材质|材料|媒介))?\s*[：:]?\s*/i, "")
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

def normalize(value)
  value.to_s.downcase.gsub(/[《》（）()：:\s_\-—–,，.。]/, "")
end

def signature(record)
  [:artworkId, :titleZh, :titleEn, :year, :dimensions, :medium].map { |key| normalize(record[key]) }.join("|")
end

def metadata_signature(record)
  [:titleZh, :titleEn, :year, :dimensions, :medium].map { |key| normalize(record[key]) }.join("|")
end

def version_score(filename)
  score = 0
  score += 5 if filename =~ /中英双语/i
  score += 4 if filename =~ /Final|最终|正式|修正/i
  score += 2 if filename =~ /KXW-\d{3}/
  score -= 3 if filename =~ /副本|copy/i
  score -= 1 if filename =~ /两页版|模板/i
  score
end

def parse_record(path)
  filename = File.basename(path)
  text = docx_text(path)
  source_id = first_match(text, FIELD_LABELS.fetch(:artworkId))

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
    lines = text.lines.map(&:strip)
    idx = lines.index { |line| line =~ /作品名称\s*[|｜]?\s*Title/i || line =~ /^Title$/i }
    idx ? clean_value(lines[(idx + 2)..-1].to_a.find { |line| !line.empty? }) : nil
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

  {
    file: filename,
    path: path,
    artworkId: clean_display_value(source_id || fallback_id(filename)),
    titleZh: title_zh,
    titleEn: title_en,
    year: clean_display_value(year),
    dimensions: clean_display_value(dimensions),
    medium: clean_display_value(medium),
    imageHash: media_hash(path),
    versionScore: version_score(filename)
  }
end

def record_lines(record)
  [
    "- File: `#{record[:file]}`",
    "  - Artwork ID: #{record[:artworkId]}",
    "  - Chinese title: #{record[:titleZh]}",
    "  - English title: #{record[:titleEn]}",
    "  - Year: #{record[:year]}",
    "  - Dimensions: #{record[:dimensions]}",
    "  - Medium: #{record[:medium]}",
    "  - Embedded image hash: #{record[:imageHash][0, 16]}"
  ]
end

files = Dir[File.join(CATALOGUE_DIR, "*.docx")]
  .reject { |path| File.basename(path).start_with?("._") }
  .sort

series_files = files.select { |path| File.basename(path).include?("Series_Master") || File.basename(path).include?("Series Master") }
candidate_files = files - series_files
records = candidate_files.map { |path| parse_record(path) }

confirmed_sets = {}
candidate_groups = []

records.group_by { |record| signature(record) }
  .each do |key, matches|
    next if key.gsub("|", "").empty? || matches.length < 2

    confirmed_sets[matches.map { |record| record[:file] }.sort.join("|")] = {
      reasons: ["Same Artwork ID, Chinese title, English title, year, dimensions, and medium"],
      records: matches
    }
  end

records.group_by { |record| [metadata_signature(record), record[:imageHash]].join("|") }
  .each do |key, matches|
    next if key.gsub("|", "").empty? || matches.length < 2

    set_key = matches.map { |record| record[:file] }.sort.join("|")
    confirmed_sets[set_key] ||= { reasons: [], records: matches }
    confirmed_sets[set_key][:reasons] << "Same title/year/dimensions/medium and same embedded image"
  end

confirmed_sets.each_value { |group| candidate_groups << group }

removal_suggestions = candidate_groups.flat_map do |group|
  preferred = group[:records].max_by { |record| [record[:versionScore], record[:file].include?("副本") ? 0 : 1, record[:file]] }
  group[:records] - [preferred]
end

confirmed_files = candidate_groups.flat_map { |group| group[:records].map { |record| record[:file] } }.uniq

id_conflicts = []
records.group_by { |record| normalize(record[:artworkId]) }
  .each do |key, matches|
    next if key.empty? || matches.length < 2
    next if (matches.map { |record| record[:file] } - confirmed_files).empty?
    next if matches.map { |record| metadata_signature(record) }.uniq.length == 1

    id_conflicts << matches
  end

image_conflicts = []
records.group_by { |record| record[:imageHash] }
  .each do |key, matches|
    next if key.empty? || matches.length < 2
    next if (matches.map { |record| record[:file] } - confirmed_files).empty?
    next if matches.map { |record| metadata_signature(record) }.uniq.length == 1

    image_conflicts << matches
  end

extra_count_note = candidate_files.length == 67 ? nil : "The folder currently has #{candidate_files.length} Word files after excluding the series master, while the expected audit set is 67."

lines = [
  "# Catalogue Duplicate / Old Version Report",
  "",
  "Source folder: `#{CATALOGUE_DIR}`",
  "",
  "- Word files found: #{files.length}",
  "- Excluded series/master files: #{series_files.length}",
  "- Candidate artwork Word records scanned: #{records.length}",
  "- Confirmed duplicate / old-version groups: #{candidate_groups.length}",
  "- ID-conflict-only groups: #{id_conflicts.length}",
  "- Image-conflict-only groups: #{image_conflicts.length}",
  "",
  "No source files were modified or deleted.",
  ""
]

if extra_count_note
  lines << "## Count Note"
  lines << ""
  lines << extra_count_note
  lines << "This report includes all #{candidate_files.length} candidate Word records so the extra file can be reviewed instead of hidden."
  lines << "If the suggested duplicate removal below is confirmed, the candidate artwork record count becomes #{candidate_files.length - removal_suggestions.length}."
  lines << ""
end

lines << "## Suggested Files To Remove After Confirmation"
lines << ""
if removal_suggestions.empty?
  lines << "No files are recommended for removal."
else
  removal_suggestions.each { |record| lines << "- `#{record[:file]}`" }
end
lines << ""

if candidate_groups.empty?
  lines << "## Confirmed Duplicate / Old-Version Candidates"
  lines << ""
  lines << "No confirmed duplicate or old-version candidates were detected by the requested metadata fields."
  lines << ""
else
  lines << "## Confirmed Duplicate / Old-Version Candidates"
  lines << ""
  candidate_groups.each_with_index do |group, index|
    matches = group[:records]
    preferred = matches.max_by { |record| [record[:versionScore], record[:file].include?("副本") ? 0 : 1, record[:file]] }
    removable = matches - [preferred]

    lines << "### Group #{index + 1}"
    lines << ""
    lines << "Matched by: #{group[:reasons].uniq.join("; ")}"
    lines << ""
    matches.each { |record| lines.concat(record_lines(record)) }
    lines << ""
    lines << "Suggested keep: `#{preferred[:file]}`"
    lines << "Suggested remove only after your confirmation:"
    removable.each { |record| lines << "- `#{record[:file]}`" }
    lines << ""
  end
end

if id_conflicts.any?
  lines << "## ID Conflicts Only"
  lines << ""
  lines << "These files share an Artwork ID but have different titles, dimensions, medium, year, or image. I do not recommend removing them as duplicates based on this report alone."
  lines << ""
  id_conflicts.each_with_index do |matches, index|
    lines << "### ID Conflict #{index + 1}"
    lines << ""
    matches.each { |record| lines.concat(record_lines(record)) }
    lines << ""
  end
end

if image_conflicts.any?
  lines << "## Image Conflicts Only"
  lines << ""
  lines << "These files share the same embedded image but do not share the full requested metadata signature."
  lines << ""
  image_conflicts.each_with_index do |matches, index|
    lines << "### Image Conflict #{index + 1}"
    lines << ""
    matches.each { |record| lines.concat(record_lines(record)) }
    lines << ""
  end
end

if candidate_groups.empty? && id_conflicts.empty? && image_conflicts.empty?
  lines << "No duplicate files, old versions, copies, ID conflicts, or image conflicts were detected."
  lines << ""
end

File.write(REPORT, lines.join("\n") + "\n")
puts "Scanned #{records.length} candidate artwork records"
puts "Confirmed duplicate / old-version groups: #{candidate_groups.length}"
puts "ID-conflict-only groups: #{id_conflicts.length}"
