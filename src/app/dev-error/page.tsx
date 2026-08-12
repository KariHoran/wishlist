export const dynamic = "force-dynamic";

export default function DevErrorPage() {
  throw new Error("Intentional error for global boundary preview");
}
