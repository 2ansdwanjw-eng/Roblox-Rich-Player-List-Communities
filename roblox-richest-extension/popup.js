const inputEl = document.getElementById('communityInput');
const searchBtn = document.getElementById('searchBtn');
const refreshBtn = document.getElementById('refreshBtn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

let lastGroupId = null;
let lastData = null;

function setStatus(text, isError=false){
	statusEl.textContent = text || '';
	statusEl.classList.toggle('error', isError);
}

function extractGroupId(raw){
	if(!raw) return null;
	const trimmed = String(raw).trim();
	// Prefer extracting from modern communities path or legacy groups path
	const comm = trimmed.match(/\/communities\/(\d+)/);
	if(comm && comm[1]) return comm[1];
	const grp = trimmed.match(/\/groups\/(\d+)/);
	if(grp && grp[1]) return grp[1];
	// Fallback: first long digit run
	const idMatch = trimmed.match(/\d{3,}/);
	return idMatch ? idMatch[0] : null;
}

async function fetchJson(url){
	const res = await fetch(url, { credentials: 'include' });
	if(!res.ok){
		throw new Error(`HTTP ${res.status} for ${url}`);
	}
	return res.json();
}

async function fetchJsonPost(url, body){
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body)
	});
	if(!res.ok){
		throw new Error(`HTTP ${res.status} for ${url}`);
	}
	return res.json();
}

async function validateGroupId(groupId){
	const data = await fetchJson(`https://groups.roblox.com/v2/groups?groupIds=${groupId}`);
	if(!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) return false;
	return Boolean(data.data.find(g => String(g.id) === String(groupId)));
}

async function fetchAllMembers(groupId){
	const rolesData = await fetchJson(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
	const roles = rolesData.roles || [];
	const allMembers = [];
	for(const role of roles){
		let cursor = '';
		do{
			const url = `https://groups.roblox.com/v1/groups/${groupId}/roles/${role.id}/users?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
			const page = await fetchJson(url);
			for(const u of (page.data || [])){
				allMembers.push({ userId: u.user.userId, username: u.user.username });
			}
			cursor = page.nextPageCursor;
		} while(cursor);
	}
	const seen = new Set();
	const unique = [];
	for(const m of allMembers){
		if(!seen.has(m.userId)){
			seen.add(m.userId);
			unique.push(m);
		}
	}
	return unique;
}

async function fetchUserAvatarThumbs(userIds){
	if(userIds.length === 0) return {};
	const chunks = chunk(userIds, 100);
	const map = {};
	for(const ch of chunks){
		const q = new URLSearchParams({ userIds: ch.join(','), size: '48x48', format: 'Png', isCircular: 'true' });
		const data = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?${q.toString()}`);
		for(const item of (data.data || [])){
			map[String(item.targetId)] = item.imageUrl;
		}
	}
	return map;
}

function chunk(arr, size){
	const out = [];
	for(let i=0;i<arr.length;i+=size){ out.push(arr.slice(i, i+size)); }
	return out;
}

async function fetchAssetCreators(assetIds){
	// Returns a map: assetId -> { creatorId, creatorName, creatorType }
	const resultMap = {};
	const ids = assetIds.map(id => String(id));
	const chunksOfIds = chunk(ids, 50);
	// Try GET endpoint first
	for(const ch of chunksOfIds){
		try{
			const url = `https://catalog.roblox.com/v1/assets?assetIds=${ch.join(',')}`;
			const data = await fetchJson(url);
			const list = Array.isArray(data) ? data : (data && data.data ? data.data : []);
			for(const item of list){
				const assetId = String(item.id || item.assetId);
				if(!assetId) continue;
				const creator = item.creator || item.Creator || {};
				resultMap[assetId] = {
					creatorId: String(creator.creatorTargetId || creator.Id || creator.id || ''),
					creatorName: creator.name || creator.Name || '',
					creatorType: creator.creatorType || creator.Type || creator.type || ''
				};
			}
		}catch(_e){
			// ignore; fallback below
		}
	}
	// Fallback to POST items/details for any missing ids
	const missing = ids.filter(id => !resultMap[id]);
	const postChunks = chunk(missing, 60);
	for(const ch of postChunks){
		try{
			const items = ch.map(id => ({ itemType: 'Asset', id: Number(id) }));
			const data = await fetchJsonPost('https://catalog.roblox.com/v1/catalog/items/details', { items });
			for(const item of (data.data || data || [])){
				const assetId = String(item.id || item.assetId);
				if(!assetId) continue;
				const creator = item.creator || item.itemCreator || {};
				resultMap[assetId] = {
					creatorId: String(creator.id || creator.creatorTargetId || ''),
					creatorName: creator.name || '',
					creatorType: creator.type || creator.creatorType || ''
				};
			}
		}catch(_e){
			// ignore; if still missing, will be filtered out later
		}
	}
	return resultMap;
}

async function fetchUserLimitedRAP(userId){
	// Collectibles endpoint returns limited items. Filter to Roblox-created and RAP >= 10,000.
	let cursor = '';
	const prelim = [];
	while(true){
		const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
		const data = await fetchJson(url);
		for(const item of (data.data || [])){
			const rap = Number(item.recentAveragePrice || item.recentAverageSalePrice || 0);
			if(rap >= 10000){
				prelim.push({ assetId: String(item.assetId), name: item.name || item.assetName || `Asset ${item.assetId}`, rap });
			}
		}
		if(!data.nextPageCursor) break;
		cursor = data.nextPageCursor;
	}
	if(prelim.length === 0){
		return { totalRAP: 0, qualifyingCount: 0, ownedItems: [] };
	}
	const uniqueAssetIds = Array.from(new Set(prelim.map(i => i.assetId)));
	const creatorsMap = await fetchAssetCreators(uniqueAssetIds);
	let totalRAP = 0;
	const ownedItems = [];
	for(const it of prelim){
		const meta = creatorsMap[it.assetId];
		if(!meta) continue;
		const isRoblox = String(meta.creatorId) === '1' || meta.creatorName === 'Roblox';
		if(isRoblox){
			totalRAP += it.rap;
			ownedItems.push({ id: it.assetId, name: it.name, rap: it.rap });
		}
	}
	return { totalRAP, qualifyingCount: ownedItems.length, ownedItems };
}

async function enrichMembersWithValue(members){
	const result = [];
	const chunks = chunk(members, 12); // reduce concurrency due to heavier catalog lookups
	for(const ch of chunks){
		const promises = ch.map(async (m) => {
			try{
				const { totalRAP, qualifyingCount, ownedItems } = await fetchUserLimitedRAP(m.userId);
				return { ...m, totalRAP, qualifyingCount, ownedItems };
			}catch(err){
				return { ...m, totalRAP: 0, qualifyingCount: 0, ownedItems: [] };
			}
		});
		const batch = await Promise.all(promises);
		result.push(...batch);
	}
	return result;
}

function renderList(members){
	resultsEl.innerHTML = '';
	if(members.length === 0){
		resultsEl.innerHTML = '<div class="small">No members found.</div>';
		return;
	}
	const header = document.createElement('div');
	header.className = 'list-header';
	header.innerHTML = `<div class="sub">Members: ${members.length}</div><div class="sort-tip">Sorted by total RAP ≥ 10,000 (Roblox-made limiteds)</div>`;
	resultsEl.appendChild(header);

	for(const m of members){
		const card = document.createElement('div');
		card.className = 'card';
		card.innerHTML = `
			<div class="header">
				<img class="avatar" data-userid="${m.userId}" alt=""/>
				<div>
					<div class="username"><a href="https://www.roblox.com/users/${m.userId}/profile" target="_blank" rel="noreferrer noopener">${m.username}</a></div>
					<div class="sub">Total RAP: ${formatNumber(m.totalRAP)} • Qualifying items: ${m.qualifyingCount}</div>
				</div>
			</div>
			${m.ownedItems && m.ownedItems.length ? '<hr/>' : ''}
			${m.ownedItems && m.ownedItems.length ? `<div class="badges">${m.ownedItems.slice(0,6).map(i=>`<span class=\"badge\" title=\"RAP ${formatNumber(i.rap)}\">${escapeHtml(i.name)}</span>`).join('')}${m.ownedItems.length>6?`<span class=\"badge\">+${m.ownedItems.length-6} more</span>`:''}</div>` : ''}
		`;
		resultsEl.appendChild(card);
	}
}

function escapeHtml(str){
	return String(str).replace(/[&<>"']/g, s => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[s]));
}

function formatNumber(n){
	return Number(n||0).toLocaleString();
}

async function loadAvatars(members){
	const ids = members.map(m=>m.userId);
	const map = await fetchUserAvatarThumbs(ids);
	const imgs = resultsEl.querySelectorAll('img.avatar');
	for(const img of imgs){
		const id = img.getAttribute('data-userid');
		if(map[id]) img.src = map[id];
	}
}

async function run(groupId){
	setStatus('Fetching members...');
	refreshBtn.disabled = true;
	resultsEl.innerHTML = '';

	const members = await fetchAllMembers(groupId);
	setStatus(`Found ${members.length} members. Calculating values...`);

	const valued = await enrichMembersWithValue(members);
	valued.sort((a,b)=> b.totalRAP - a.totalRAP);
	lastData = valued;
	renderList(valued);
	await loadAvatars(valued);
	setStatus('Done.');
	refreshBtn.disabled = false;
}

searchBtn.addEventListener('click', async () => {
	try{
		setStatus('');
		const groupId = extractGroupId(inputEl.value);
		if(!groupId){
			setStatus('Enter a Roblox community link or numeric ID.', true);
			return;
		}
		setStatus('Validating community...');
		const valid = await validateGroupId(groupId);
		if(!valid){
			setStatus('Invalid community ID.', true);
			return;
		}
		lastGroupId = groupId;
		await run(groupId);
	}catch(err){
		setStatus(String(err.message || err), true);
	}
});

refreshBtn.addEventListener('click', async () => {
	if(!lastGroupId) return;
	await run(lastGroupId);
});

inputEl.addEventListener('keydown', (e)=>{
	if(e.key === 'Enter'){
		e.preventDefault();
		searchBtn.click();
	}
});