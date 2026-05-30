// still breaks with any link that has a radio playlist at the end
browser.runtime.onMessage.addListener(async (message) => {
	const links = new Set();
	if (message.action === "grabVisibleLinks") {
		links.clear();

		function stripRadioPrefix(id) {
			if (!id) return id;
			if (id.startsWith("RD")) return id.slice(2);
			return id;
		}

		function normalize(url) {
			if (!url) return null;

			url = url.trim().replace(/[\\)\]}>,.!?]+$/g, "");

			// add protocol if missing
			if (
				url.startsWith("youtube.com/") ||
				url.startsWith("www.youtube.com/") ||
				url.startsWith("youtu.be/")
			)
				url = "https://" + url;

			try {
				// supports relative urls from google search
				const parsed = new URL(url, location.href);
				// google redirect support
				const redirected =
					parsed.searchParams.get("url") ||
					parsed.searchParams.get("q");
				if (redirected) return normalize(decodeURIComponent(redirected));
				const host = parsed.hostname.replace(/^www\./, "");
				if (host === "youtu.be") {
					const id = parsed.pathname.slice(1);
					// if (id) return `https://youtu.be/${id}`;
					if (id) return stripRadioPrefix(id);
				}
				if (host === "youtube.com") {
					// WATCH LINKS
					if (parsed.pathname === "/watch") {
						const v = parsed.searchParams.get("v");
						const list = parsed.searchParams.get("list");

						// video + playlist
						// video only
						// if (v) return `https://www.youtube.com/watch?v=${v}`;
						if (v) return v;
						// if (v && list) return `https://www.youtube.com/watch?v=${v}&list=${list}`;
						if ((v && list) || list) return stripRadioPrefix(list);
						// playlist only
						// if (list) return `https://www.youtube.com/playlist?list=${list}`;
					}
					// PLAYLIST PAGE
					if (parsed.pathname === "/playlist") {
						const list = parsed.searchParams.get("list");
						// if (list) return `https://www.youtube.com/playlist?list=${list}`;
						if (list) return stripRadioPrefix(list);
					}
					// SHORTS
					if (parsed.pathname.startsWith("/shorts/")) {
						const id = parsed.pathname.split("/")[2];
						// if (id) return `https://www.youtube.com/shorts/${id}`;
						if (id) return stripRadioPrefix(id);
					}
					// EMBED
					if (parsed.pathname.startsWith("/embed/")) {
						const id = parsed.pathname.split("/")[2];
						// if (id) return `https://youtube.com/embed/${id}`;
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
				rect.width > 0 &&
				rect.height > 0 &&
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

		const pageText = document.body.innerText + "\n" + document.body.textContent;
		const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s"'<>\\]+|playlist\?[^\s"'<>\\]+|shorts\/[^\s"'<>\\]+|embed\/[^\s"'<>\\]+)|youtu\.be\/[^\s"'<>\\]+)/gi;
		const matches = [...pageText.matchAll(regex)];

		for (const match of matches) addIfYouTube(match[0]);

		return { links: [...links] };
	}
});