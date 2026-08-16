// GitHub-style heading slug. MUST stay in sync with the frontend copy used to add
// `id`s to rendered handout headings (frontend_v1/app/lib/slug.ts) so a study
// block's `#anchor` deep-link lands on the right section.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // strip punctuation
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphen
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
