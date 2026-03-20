import { memo, useEffect, useRef, useState } from 'react';
import type { SocketHealthSlotId } from './socketHealthStore';
import { socketHealthPeekInboundSeq } from './socketHealthStore';
import * as P from '../styles/socketHealthPulse.style';

const SEQ_POLL_MS = 200;

/**
 * 綠點呼吸動畫；輕量輪詢 inboundSeq（200ms）偵測新訊息，以重掛載 FlashBurst 觸發單次閃爍。
 */
export const MessagePulse = memo(function MessagePulse({ slotId }: { slotId: SocketHealthSlotId }) {
  const [burstKey, setBurstKey] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const seq = socketHealthPeekInboundSeq(slotId);
      if (seq !== seqRef.current) {
        seqRef.current = seq;
        if (seq > 0) setBurstKey((k) => k + 1);
      }
    }, SEQ_POLL_MS);
    return () => clearInterval(id);
  }, [slotId]);

  return (
    <P.PulseRow aria-hidden>
      <P.DotWrap>
        <P.Dot />
        {burstKey > 0 ? <P.FlashBurst key={burstKey} /> : null}
      </P.DotWrap>
    </P.PulseRow>
  );
});
