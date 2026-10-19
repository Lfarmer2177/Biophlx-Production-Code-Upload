import { listSessionItemsBySession, listSessionItemSetsQuery, listSessionItemRepsQuery } from '../../graphql/queries';
export async function loadSessionReps(client, sessionId) {
  const result = [], seenTokens = new Set();
  let nextToken;
  do {
    const response = await client.graphql({ query: listSessionItemRepsQuery, variables: { session_id: sessionId, limit: 500, nextToken } });
    if (response.errors?.length) throw new Error('Rep history could not be loaded.');
    const page = response.data?.listSessionItemReps;
    if (!page || (!Array.isArray(page) && !Array.isArray(page.items))) throw new Error('Rep history response is unavailable.');
    result.push(...(Array.isArray(page) ? page : page.items).filter(rep => rep && rep.session_id === sessionId));
    nextToken = page.nextToken;
    if (nextToken && seenTokens.has(nextToken)) throw new Error('Rep history pagination did not advance.');
    if (nextToken) seenTokens.add(nextToken);
  } while (nextToken);
  // Retry overlap must not count the same persisted rep twice.
  return [...new Map(result.map(rep => [`${rep.session_id}:${rep.session_item_index}:${rep.session_item_set_index}:${rep.session_item_rep_index}`, rep])).values()];
}



const arrayResult = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : null;

export async function loadSessionDetails(client, sessionId) {
  const [response, reps] = await Promise.all([
    client.graphql({ query: listSessionItemsBySession, variables: { session_id: sessionId, limit: 1000 } }),
    loadSessionReps(client, sessionId),
  ]);
  const items = arrayResult(response.data?.listSessionItemsBySession);
  if (response.errors?.length || !items) throw new Error('Session exercises could not be loaded.');
  const byIndex = new Map(items.filter(item => item.session_id === sessionId).map(item => [Number(item.session_item_index), item]));
  // Preserve recorded reps even when an exercise metadata row is missing.
  for (const rep of reps) {
    const index = Number(rep.session_item_index);
    if (!byIndex.has(index)) byIndex.set(index, { session_id: sessionId, session_item_index: index });
  }
  const result = [];
  for (const [index, item] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
    let sets = [], setsError = false;
    try {
      const response = await client.graphql({ query: listSessionItemSetsQuery,
        variables: { session_id: sessionId, session_item_index: index, limit: 1000 } });
      const rows = arrayResult(response.data?.listSessionItemSets);
      if (response.errors?.length || !rows) throw new Error('Set metadata unavailable.');
      sets = rows.filter(set => set.session_id === sessionId && Number(set.session_item_index) === index);
    } catch { setsError = true; }
    result.push({ ...item, sets, setsError, reps: reps.filter(rep => Number(rep.session_item_index) === index) });
  }
  return result;
}
