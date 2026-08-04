#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "json"

ROOT = File.expand_path("..", __dir__)
ARCHIVE = File.join(ROOT, "data", "artwork-archive.json")
OUTPUT = File.join(ROOT, "data", "artwork-archive.csv")

db = JSON.parse(File.read(ARCHIVE))
artworks = db.fetch("artworks")
headers = %w[artworkId titleZh titleEn year medium dimensions series category image sourceFile]

CSV.open(OUTPUT, "w", write_headers: true, headers: headers) do |csv|
  artworks.each { |artwork| csv << headers.map { |field| artwork.fetch(field, "") } }
end

puts "Wrote #{OUTPUT}"
