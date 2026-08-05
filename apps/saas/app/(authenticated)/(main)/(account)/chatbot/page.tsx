import { redirect } from "next/navigation";

export default async function AiDemoPage() {
	redirect("/knowledge?stage=test");
}
