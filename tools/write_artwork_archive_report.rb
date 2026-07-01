#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"

ROOT = File.expand_path("..", __dir__)
ARCHIVE = File.join(ROOT, "data", "artwork-archive.json")
OUTPUT = File.join(ROOT, "data", "artwork-archive-report.md")

db = JSON.parse(File.read(ARCHIVE))
summary = db.fetch("summary")
artworks = db.fetch("artworks")
queue = db.fetch("reviewQueue")

def line_items(hash)
  hash.map { |key, value| "- #{key}: #{value}" }.join("\n")
end

missing_by_field = Hash.new { |hash, key| hash[key] = [] }
queue.each { |item| missing_by_field[item.fetch("field")] << item }

duplicate_lines = summary.dig("duplicateGroups", "sameTitleYearDimensionsCategory").map do |group|
  "- #{group.join(' + ')}"
end
duplicate_lines = ["- None detected"] if duplicate_lines.empty?

exact_duplicate_lines = summary.dig("duplicateGroups", "exactImageHash").map do |group|
  "- #{group.join(' + ')}"
end
exact_duplicate_lines = ["- None detected"] if exact_duplicate_lines.empty?

missing_sections = missing_by_field.sort.map do |field, items|
  rows = items.map do |item|
    artwork = artworks.find { |record| record.fetch("archiveId") == item.fetch("archiveId") }
    title = [artwork.dig("title", "en"), artwork.dig("title", "zh")].compact.reject(&:empty?).join(" / ")
    title = "(missing title)" if title.empty?
    "- #{item.fetch("archiveId")}: #{title}; source #{item.fetch("sourceFile")}; image #{item.fetch("image")}"
  end

  "## Missing #{field}\n\n#{rows.join("\n")}"
end

next_question = db["nextQuestion"]
next_question_text = if next_question
  [
    "- archiveId: #{next_question.fetch("archiveId")}",
    "- field: #{next_question.fetch("field")}",
    "- question: #{next_question.fetch("question")}",
    "- sourceFile: #{next_question.fetch("sourceFile")}",
    "- image: #{next_question.fetch("image")}"
  ].join("\n")
else
  "- No missing information remains."
end

report = <<~MARKDOWN
  # Artwork Archive Report

  This report is generated from `data/artwork-archive.json`.

  ## Summary

  - total records: #{summary.fetch("totalRecords")}

  ## Counts by Category

  #{line_items(summary.fetch("countsByCategory"))}

  ## Missing Counts

  #{line_items(summary.fetch("missingCounts"))}

  ## Duplicate Review

  Same title/year/dimensions/category:

  #{duplicate_lines.join("\n")}

  Exact image hash:

  #{exact_duplicate_lines.join("\n")}

  ## Next Question

  #{next_question_text}

  #{missing_sections.join("\n\n")}
MARKDOWN

File.write(OUTPUT, report)
puts "Wrote #{OUTPUT}"
