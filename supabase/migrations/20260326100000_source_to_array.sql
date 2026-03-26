-- Convert source column from text to text[]
-- Existing single-value rows become single-element arrays; NULL/empty become empty arrays

-- Drop existing default before changing type
alter table flashcards
  alter column source drop default;

alter table flashcards
  alter column source type text[]
  using case
    when source is null or source = '' then array[]::text[]
    else array[source]
  end;

alter table flashcards
  alter column source set default '{}';
