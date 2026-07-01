#!/usr/bin/env ruby
# frozen_string_literal: true

require "csv"
require "json"

ROOT = File.expand_path("..", __dir__)
ARCHIVE = File.join(ROOT, "data", "artwork-archive.json")
OUTPUT = File.join(ROOT, "data", "artwork-archive.csv")

db = JSON.parse(File.read(ARCHIVE))
artworks = db.fetch("artworks")

headers = [
  "archiveId",
  "recordStatus",
  "category",
  "titleEn",
  "titleZh",
  "titleStatus",
  "year",
  "dimensions",
  "mediumEn",
  "mediumZh",
  "artistStatementEn",
  "artistStatementZh",
  "missingFields",
  "duplicateReview",
  "image",
  "sourceFile",
  "existingWorkNo",
  "imageExists",
  "imageSha256",
  "pixelWidth",
  "pixelHeight",
  "confirmedFields"
]

CSV.open(OUTPUT, "w", write_headers: true, headers: headers) do |csv|
  artworks.each do |artwork|
    duplicate_review = artwork.fetch("duplicateReview").map do |item|
      "#{item.fetch("type")}: #{item.fetch("matchingArchiveIds").join("|")}"
    end.join("; ")

    csv << [
      artwork.fetch("archiveId"),
      artwork.fetch("recordStatus"),
      artwork.fetch("category"),
      artwork.dig("title", "en"),
      artwork.dig("title", "zh"),
      artwork.dig("title", "status"),
      artwork.fetch("year"),
      artwork.fetch("dimensions"),
      artwork.dig("media", "en"),
      artwork.dig("media", "zh"),
      artwork.dig("artistStatement", "en"),
      artwork.dig("artistStatement", "zh"),
      artwork.fetch("missingFields").join("|"),
      duplicate_review,
      artwork.dig("source", "image"),
      artwork.dig("source", "sourceFile"),
      artwork.dig("source", "existingWorkNo"),
      artwork.dig("imageAudit", "exists"),
      artwork.dig("imageAudit", "sha256"),
      artwork.dig("imageAudit", "pixels", "width"),
      artwork.dig("imageAudit", "pixels", "height"),
      artwork.fetch("confirmedFields").join("|")
    ]
  end
end

puts "Wrote #{OUTPUT}"
