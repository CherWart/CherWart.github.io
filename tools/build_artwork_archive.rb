#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "digest"

ROOT = File.expand_path("..", __dir__)
SOURCE = File.join(ROOT, "data", "artworks.js")
CONFIRMED = File.join(ROOT, "data", "artwork-confirmed-metadata.json")
OUTPUT = File.join(ROOT, "data", "artwork-archive.json")

raw = File.read(SOURCE)
json = raw.sub(/\A\s*window\.CHER_WANG_ARTWORKS\s*=\s*/, "").sub(/;\s*\z/, "")
records = JSON.parse(json)
confirmed_records = if File.exist?(CONFIRMED)
  JSON.parse(File.read(CONFIRMED)).fetch("records", {})
else
  {}
end

def placeholder_title?(value)
  text = value.to_s.strip
  return true if text.empty?

  !!(text =~ /\A(?:水彩作品|油画作品|版画作品)\s*\d+\z/)
end

def category_code(category)
  case category
  when "watercolor" then "WC"
  when "oil" then "OIL"
  when "printmaking" then "PR"
  else category.to_s.upcase
  end
end

def image_size(path)
  output = `sips -g pixelWidth -g pixelHeight "#{path}" 2>/dev/null`
  width = output[/pixelWidth:\s*(\d+)/, 1]
  height = output[/pixelHeight:\s*(\d+)/, 1]
  return nil unless width && height

  { "width" => width.to_i, "height" => height.to_i }
end

def present?(value)
  case value
  when Hash
    value.values.any? { |nested| present?(nested) }
  else
    !value.to_s.strip.empty?
  end
end

archive = records.each_with_index.map do |record, index|
  absolute_image = File.join(ROOT, record.fetch("image"))
  image_exists = File.exist?(absolute_image)
  digest = image_exists ? Digest::SHA256.file(absolute_image).hexdigest : nil
  pixels = image_exists ? image_size(absolute_image) : nil
  category = record["category"].to_s
  sequence = record["image"].to_s[/(\d+)(?=\.[^.]+\z)/, 1] || (index + 1).to_s
  archive_id = "WKX-#{category_code(category)}-#{sequence.rjust(3, "0")}"
  confirmed = confirmed_records.fetch(archive_id, {})

  title_en = record["titleEn"].to_s.strip
  title_zh = record["titleZh"].to_s.strip
  year = record["year"].to_s.strip
  dimensions = record["size"].to_s.strip
  medium_en = record["mediumEn"].to_s.strip
  medium_zh = record["mediumZh"].to_s.strip
  title_missing = placeholder_title?(title_en) && placeholder_title?(title_zh)
  confirmed_title = confirmed.fetch("title", {})
  confirmed_media = confirmed.fetch("media", {})
  confirmed_statement = confirmed.fetch("artistStatement", {})

  archive_title_en = title_missing ? "" : title_en
  archive_title_zh = title_missing ? "" : title_zh
  title_status = title_missing ? "missing_placeholder_in_source" : "from_source"

  if present?(confirmed_title)
    archive_title_en = confirmed_title.fetch("en", archive_title_en).to_s.strip
    archive_title_zh = confirmed_title.fetch("zh", archive_title_zh).to_s.strip
    title_status = "artist_confirmed"
  end

  archive_year = confirmed.fetch("year", year).to_s.strip
  archive_dimensions = confirmed.fetch("dimensions", dimensions).to_s.strip
  archive_medium_en = confirmed_media.fetch("en", medium_en).to_s.strip
  archive_medium_zh = confirmed_media.fetch("zh", medium_zh).to_s.strip
  archive_statement_en = confirmed_statement.fetch("en", "").to_s.strip
  archive_statement_zh = confirmed_statement.fetch("zh", "").to_s.strip

  missing = []
  missing << "title" if archive_title_en.empty? && archive_title_zh.empty?
  missing << "year" if archive_year.empty?
  missing << "dimensions" if archive_dimensions.empty?
  missing << "media" if archive_medium_en.empty? && archive_medium_zh.empty?
  missing << "artistStatement" if archive_statement_en.empty? && archive_statement_zh.empty?

  {
    "archiveId" => archive_id,
    "recordStatus" => missing.empty? ? "complete" : "needs_information",
    "category" => category,
    "title" => {
      "en" => archive_title_en,
      "zh" => archive_title_zh,
      "sourceTitleEn" => title_en,
      "sourceTitleZh" => title_zh,
      "status" => title_status
    },
    "year" => archive_year,
    "dimensions" => archive_dimensions,
    "media" => {
      "en" => archive_medium_en,
      "zh" => archive_medium_zh
    },
    "artistStatement" => {
      "en" => archive_statement_en,
      "zh" => archive_statement_zh
    },
    "confirmedFields" => confirmed.keys.sort,
    "source" => {
      "image" => record["image"],
      "sourceFile" => record["sourceFile"].to_s,
      "existingWorkNo" => record["workNo"].to_s
    },
    "imageAudit" => {
      "exists" => image_exists,
      "sha256" => digest,
      "pixels" => pixels
    },
    "missingFields" => missing,
    "duplicateReview" => []
  }
end

by_hash = archive.group_by { |item| item.dig("imageAudit", "sha256") }.reject { |hash, items| hash.nil? || items.length < 2 }
identity_groups = Hash.new { |hash, key| hash[key] = [] }
archive.each do |item|
  next if item["year"].to_s.empty? || item["dimensions"].to_s.empty?

  [item.dig("title", "en"), item.dig("title", "zh")].compact.map(&:strip).reject(&:empty?).uniq.each do |title|
    identity_groups[[title, item["year"], item["dimensions"], item["category"]].join("||")] << item
  end
end
by_identity = identity_groups.reject { |_key, items| items.uniq.length < 2 }.transform_values(&:uniq)

by_hash.each_value do |items|
  ids = items.map { |item| item["archiveId"] }
  items.each do |item|
    item["duplicateReview"] << {
      "type" => "exact_image_hash_match",
      "matchingArchiveIds" => ids - [item["archiveId"]],
      "status" => "needs_artist_review"
    }
  end
end

by_identity.each_value do |items|
  ids = items.map { |item| item["archiveId"] }
  items.each do |item|
    item["duplicateReview"] << {
      "type" => "same_title_year_dimensions_category",
      "matchingArchiveIds" => ids - [item["archiveId"]],
      "status" => "needs_artist_review"
    }
  end
end

summary = {
  "totalRecords" => archive.length,
  "countsByCategory" => archive.group_by { |item| item["category"] }.transform_values(&:length),
  "missingCounts" => archive.each_with_object(Hash.new(0)) do |item, counts|
    item["missingFields"].each { |field| counts[field] += 1 }
  end.sort.to_h,
  "duplicateGroups" => {
    "exactImageHash" => by_hash.values.map { |items| items.map { |item| item["archiveId"] } },
    "sameTitleYearDimensionsCategory" => by_identity.values.map { |items| items.map { |item| item["archiveId"] } }
  }
}

field_question = {
  "title" => "What is the correct title for this artwork?",
  "year" => "What year was this artwork completed?",
  "dimensions" => "What are the artwork dimensions?",
  "media" => "What is the artwork medium/material?",
  "artistStatement" => "What artist statement should be recorded for this artwork?"
}

review_queue = archive.flat_map do |item|
  item["missingFields"].map do |field|
    {
      "archiveId" => item["archiveId"],
      "field" => field,
      "question" => field_question.fetch(field),
      "image" => item.dig("source", "image"),
      "sourceFile" => item.dig("source", "sourceFile"),
      "status" => "needs_artist_answer"
    }
  end
end

database = {
  "schemaVersion" => "1.0",
  "project" => "Artwork Archive Master Database",
  "rules" => [
    "Never invent missing artwork information.",
    "Never rename artworks without artist confirmation.",
    "Ask for missing information one artwork at a time."
  ],
  "sourceFile" => "data/artworks.js",
  "confirmedMetadataFile" => "data/artwork-confirmed-metadata.json",
  "summary" => summary,
  "reviewQueue" => review_queue,
  "nextQuestion" => review_queue.first,
  "artworks" => archive
}

File.write(OUTPUT, JSON.pretty_generate(database) + "\n")
puts "Wrote #{OUTPUT}"
puts JSON.pretty_generate(summary)
