import { redirect } from "next/navigation";

export default function KnowledgeUnitsPage() {
	redirect("/knowledge?stage=advanced");
}
