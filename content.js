browser.runtime.onMessage.addListener(async message => {
	if (message.action === "grabVisibleLinks") {
		const links = new Set();

		function stripRadioPrefix(id) {
			if (!id) return id;
			if (id.startsWith("RD")) return id.slice(2);
			return id;
		}

		function normalize(url) {
			if (!url) return null;
			url = url.trim().replace(/[\\)\]}>,.!?]+$/g, "");

			// add protocol so protocol-less URLs (e.g. "youtube.com/watch?v=...") are parsed correctly
			if (/^(?:www\.)?youtube\.com\//.test(url) || /^youtu\.be\//.test(url))
				url = "https://" + url;

			try {
				// supports relative urls from google search
				const parsed = new URL(url, location.href);
				// google redirect support
				const redirected = parsed.searchParams.get("url") || parsed.searchParams.get("q");
				if (redirected) return normalize(decodeURIComponent(redirected));
				const host = parsed.hostname.replace(/^www\./, "");
				if (host === "youtu.be") {
					const id = parsed.pathname.slice(1);
					if (id) return stripRadioPrefix(id);
				}
				if (host === "youtube.com") {
					if (parsed.pathname === "/watch") {
						const v = parsed.searchParams.get("v");
						const list = parsed.searchParams.get("list");
						if (v) return v;
						if (list) return stripRadioPrefix(list);
					}
					if (parsed.pathname === "/playlist") {
						const list = parsed.searchParams.get("list");
						if (list) return stripRadioPrefix(list);
					}
					if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
						const id = parsed.pathname.split("/")[2];
						if (id) return stripRadioPrefix(id);
					}
				}
			} catch {}

			return null;
		}

		function isAllowedId(id) {
			if (!id) return false;
			const blocked = new Set(["WL", "LL"]);
			return !blocked.has(id);
		}

		function addIfYouTube(url) {
			const normalized = normalize(url);
			if (normalized && isAllowedId(normalized)) links.add(normalized);
		}

		// get links from attributes, tags, embeds
		const elements = document.querySelectorAll(`
			a[href],
			iframe[src],
			embed[src],
			object[data],
			video[src],
			source[src]
		`);

		function isVisible(el) {
			const rect = el.getBoundingClientRect();
			return (
				rect.width > 0 && rect.height > 0 &&
				window.getComputedStyle(el).visibility !== "hidden" &&
				window.getComputedStyle(el).display !== "none"
			);
		}

		for (const el of elements) {
			if (!isVisible(el)) continue;
			const attrs = [
				el.getAttribute("href"),
				el.getAttribute("src"),
				el.getAttribute("data")
			];
			for (const attr of attrs) {
				if (!attr) continue;
				// google redirect support
				try {
					const parsed = new URL(attr, location.href);
					const redirected = parsed.searchParams.get("url") || parsed.searchParams.get("q");
					if (redirected) addIfYouTube(decodeURIComponent(redirected));
				} catch {}
				addIfYouTube(attr);
			}
		}

		const pageText = document.body.textContent;
		const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s"'<>\\]+|playlist\?[^\s"'<>\\]+|shorts\/[^\s"'<>\\]+|embed\/[^\s"'<>\\]+)|youtu\.be\/[^\s"'<>\\]+)/gi;
		const matches = [...pageText.matchAll(regex)];

		for (const match of matches) addIfYouTube(match[0]);

		return { links: [...links] };
	}

	if (message.action === "writeClipboard") await navigator.clipboard.writeText(message.text);
});