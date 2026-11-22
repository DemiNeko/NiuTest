const pendingWrites = new WeakMap();
const unavailableStorage = {};

function readValue(storage, key) {
  const pending = pendingWrites.get(storage ?? unavailableStorage)?.get(key);
  if (pending !== undefined) return pending;
  try { return storage?.getItem(key) ?? null; }
  catch { return null; }
}

function writeValue(storage, key, value) {
  try {
    storage.setItem(key, value);
    pendingWrites.get(storage)?.delete(key);
  } catch {
    // Keep this session usable if privacy settings or the quota prevent a write.
    const owner = storage ?? unavailableStorage;
    if (!pendingWrites.has(owner)) pendingWrites.set(owner, new Map());
    pendingWrites.get(owner).set(key, value);
  }
}

const prefix = collection => `niutest-ticket-visits-v1:${collection.id}:`;

export function readTicketProgress(storage, collection) {
  const key = prefix(collection);
  const visited = [];
  for (let number = 1; number <= collection.count; number++) {
    if (readValue(storage, key + number) === '1') visited.push(number);
  }
  const storedLast = readValue(storage, key + 'last');
  const last = Number(storedLast);
  return { visited, last: String(last) === storedLast && visited.includes(last) ? last : null };
}

export function saveTicketVisit(storage, collection, number) {
  const progress = readTicketProgress(storage, collection);
  if (!Number.isInteger(number) || number < 1 || number > collection.count) return progress;

  const key = prefix(collection);
  // Independent markers let simultaneous visits to different tickets both survive.
  if (!progress.visited.includes(number)) {
    writeValue(storage, key + number, '1');
    progress.visited.push(number);
    progress.visited.sort((a, b) => a - b);
  }
  if (progress.last !== number) writeValue(storage, key + 'last', String(number));
  return { visited: progress.visited, last: number };
}
