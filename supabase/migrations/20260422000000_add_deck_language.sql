-- Add language and script columns to decks
-- language: BCP 47 primary subtag ('vi', 'zh')
-- script: for Chinese only ('simplified' | 'traditional'), null for other languages
ALTER TABLE decks
  ADD COLUMN language text NOT NULL DEFAULT 'vi',
  ADD COLUMN script text;
