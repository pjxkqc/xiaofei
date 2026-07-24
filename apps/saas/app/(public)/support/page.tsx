import { PublicSupportChat } from "@ai/components/PublicSupportChat";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "在线客服",
	description: "与小飞或真人客服进行在线咨询。",
};

export default function PublicSupportPage() {
	return <PublicSupportChat />;
}
