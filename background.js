browser.runtime.onInstalled.addListener(() => {
	browser.menus.create({
		id: "grab-youtube-ids",
		title: "Grab YouTube IDs",
		contexts: ["page", "selection"]
	});
});

browser.menus.onClicked.addListener(async (info, tab) => {
	if (info.menuItemId !== "grab-youtube-ids") return;
	try {
		const result = await browser.tabs.sendMessage(tab.id, { action: "grabVisibleLinks" });
		const links = [...new Set(result?.links || [])];

		const text = links.length ? links.join("\n") + "\n" : "";
		// if no links found, clipboard becomes empty
		console.log(links);
		for (const [index, link] of links.entries())
			console.log(`${index + 1}. (${link.length}) ${link}`);
		console.log(`Total IDs: ${links.length}`);

		await browser.tabs.sendMessage(tab.id, { action: "writeClipboard", text });
	} catch (err) {
		console.error(err);
	}
});