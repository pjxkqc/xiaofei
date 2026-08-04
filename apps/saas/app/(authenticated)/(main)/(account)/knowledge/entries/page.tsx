import { redirect } from "next/navigation";

export default function KnowledgeEntriesPage() {
	redirect("/knowledge?stage=prepare");
}
