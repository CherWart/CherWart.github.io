#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "open3"

ROOT = File.expand_path("..", __dir__)
ARCHIVE = File.join(ROOT, "data", "artwork-archive.json")
CONFIRMED = File.join(ROOT, "data", "artwork-confirmed-metadata.json")

FIELD_PATHS = {
  "title.en" => ["title", "en"],
  "title.zh" => ["title", "zh"],
  "year" => ["year"],
  "dimensions" => ["dimensions"],
  "media.en" => ["media", "en"],
  "media.zh" => ["media", "zh"],
  "artistStatement.en" => ["artistStatement", "en"],
  "artistStatement.zh" => ["artistStatement", "zh"]
}.freeze

def usage
  <<~TEXT
    Usage:
      ruby tools/record_artist_answer.rb ARCHIVE_ID FIELD VALUE

    Examples:
      ruby tools/record_artist_answer.rb WKX-WC-001 title.zh "作品标题"
      ruby tools/record_artist_answer.rb WKX-WC-001 year "2024"
      ruby tools/record_artist_answer.rb WKX-WC-001 dimensions "53 x 76 cm"

    Allowed fields:
      #{FIELD_PATHS.keys.join(", ")}
  TEXT
end

archive_id, field, value = ARGV

if archive_id.to_s.empty? || field.to_s.empty? || value.to_s.strip.empty?
  warn usage
  exit 1
end

unless FIELD_PATHS.key?(field)
  warn "Unknown field: #{field}"
  warn usage
  exit 1
end

archive = JSON.parse(File.read(ARCHIVE))
unless archive.fetch("artworks").any? { |artwork| artwork.fetch("archiveId") == archive_id }
  warn "Unknown archive ID: #{archive_id}"
  exit 1
end

confirmed = JSON.parse(File.read(CONFIRMED))
records = confirmed["records"] ||= {}
record = records[archive_id] ||= {}

path = FIELD_PATHS.fetch(field)
target = record
path[0...-1].each do |key|
  target[key] ||= {}
  target = target[key]
end
target[path.last] = value.strip

File.write(CONFIRMED, JSON.pretty_generate(confirmed) + "\n")

commands = [
  ["ruby", "tools/build_artwork_archive.rb"],
  ["ruby", "tools/write_artwork_archive_report.rb"],
  ["ruby", "tools/write_artwork_archive_csv.rb"],
  ["ruby", "tools/validate_artwork_archive.rb"]
]

commands.each do |command|
  stdout, stderr, status = Open3.capture3(*command, chdir: ROOT)
  unless status.success?
    warn stdout unless stdout.empty?
    warn stderr unless stderr.empty?
    exit status.exitstatus || 1
  end
end

puts "Recorded #{field} for #{archive_id}"
puts "Archive rebuilt and validated"
