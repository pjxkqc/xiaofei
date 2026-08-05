import { redirect } from "next/navigation";

export default function XiaofeiFallbackSettingsPage() {
	redirect("/knowledge?stage=advanced");
}
