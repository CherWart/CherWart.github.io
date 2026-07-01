#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "json"

ROOT = File.expand_path("..", __dir__)
MASTER = File.join(ROOT, "data", "artwork-archive.json")
WEBSITE = File.join(ROOT, "data", "artworks.js")
CSV_EXPORT = File.join(ROOT, "data", "artwork-archive.csv")
REPORT = File.join(ROOT, "data", "artwork-archive-report.md")

def fail_with(message)
  warn "Archive validation failed: #{message}"
  exit 1
end

[MASTER, WEBSITE, CSV_EXPORT, REPORT].each do |path|
  fail_with("missing #{path}") unless File.exist?(path)
end

master = JSON.parse(File.read(MASTER))
artworks = master.fetch("artworks")
csv = CSV.read(CSV_EXPORT, headers: true)
report = File.read(REPORT)

fail_with("record count mismatch") unless master.fetch("recordCount") == artworks.length
fail_with("CSV row count mismatch") unless csv.length == artworks.length

ids = artworks.map { |record| record.fetch("artworkId") }
fail_with("artwork IDs are not unique") unless ids.uniq.length == ids.length

required = %w[artworkId titleZh titleEn year medium dimensions series image fullRecordText]
missing = artworks.select do |record|
  required.any? { |field| record.fetch(field, "").to_s.strip.empty? }
end
fail_with("required fields missing for #{missing.map { |record| record.fetch("artworkId") }.join(", ")}") unless missing.empty?

missing_images = artworks.reject { |record| File.exist?(File.join(ROOT, record.fetch("image"))) }
fail_with("matched image files missing for #{missing_images.map { |record| record.fetch("artworkId") }.join(", ")}") unless missing_images.empty?

website_text = File.read(WEBSITE)
fail_with("website data does not expose CHER_WANG_ARTWORKS") unless website_text.include?("window.CHER_WANG_ARTWORKS")
fail_with("report missing issue count") unless report.include?("Issues requiring confirmation:")

puts "Archive validation passed"
puts "records=#{artworks.length}"
puts "images=#{artworks.length - missing_images.length}"
puts "issues=#{master.fetch("issues").length}"
