/** Serialized into the self-contained player and executed directly by the unit contract. */
export const LIVE_PLAYER_SHOULD_AUTO_ALIGN_SOURCE = `(currentTime,ranges,nowMs,userSeekUntilMs)=>{if(!Array.isArray(ranges)||ranges.length===0||nowMs<userSeekUntilMs)return false;for(const range of ranges){if(!Array.isArray(range)||range.length!==2||!Number.isFinite(range[0])||!Number.isFinite(range[1])||range[1]<range[0])return false;if(currentTime>=range[0]-.05&&currentTime<=range[1]+.05)return false}return true}`;
export const LIVE_PLAYER_USER_SEEK_GUARD_MS = 3000;
