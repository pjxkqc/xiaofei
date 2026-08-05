import { redirect } from "next/navigation";

export default function KnowledgeDocumentsPage() {
	redirect("/knowledge?stage=advanced");
}
