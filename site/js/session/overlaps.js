/**
 * Requests that ran at the same time.
 *
 * A request runs over `[start_ms, end_ms)`, so one that starts the moment another ends does not overlap it. An
 * overlap group is a maximal set of requests linked by overlaps: each overlaps at least one other in the group, and
 * none overlaps a request outside it. Agents run side by side, so a group usually joins requests of several sessions.
 */

/**
 * The overlap groups of `requests`, each an array of indices into `requests` in start order, the groups in order of
 * their first start. A request that overlaps no other is in no group.
 */
export function overlapGroups(requests) {
  const startOrder = Array.from(requests.keys());
  startOrder.sort((first, second) => requests[first].start_ms - requests[second].start_ms);
  const groups = [];
  let group = [];
  let groupEnd = -Infinity; // the latest end of the requests in `group`
  for (const index of startOrder) {
    const request = requests[index];
    if (request.start_ms < groupEnd) {
      group.push(index);
      groupEnd = Math.max(groupEnd, request.end_ms);
    } else {
      addIfOverlapping(groups, group);
      group = [index];
      groupEnd = request.end_ms;
    }
  }
  addIfOverlapping(groups, group);
  return groups;
}

// A group of one request overlaps nothing.
function addIfOverlapping(groups, group) {
  if (group.length > 1) {
    groups.push(group);
  }
}
