package com.s15p21b103.good_tashu._util.outbox.scheduler;


import com.s15p21b103.good_tashu._util.outbox.dispatcher.OutboxEventDispatcher;
import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventEntity;
import com.s15p21b103.good_tashu._util.outbox.domain.OutboxEventType;
import com.s15p21b103.good_tashu._util.outbox.repository.OutboxEventRepository;
import com.s15p21b103.good_tashu._util.outbox.service.OutboxRetryService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxScheduler {
    private final OutboxEventRepository outboxEventRepository;
    private final OutboxEventDispatcher outboxEventDispatcher;
    private final OutboxRetryService outboxRetryService;
    @Scheduled(fixedDelay = 1000)
    public void pollEvent() {
        // 시도 횟수가 가장 적으면서 id가 오름차순으로 적은 100개의 event 획득
        List<OutboxEventEntity> events = outboxEventRepository.findTop100ByOrderByAttemptCountAscOutboxEventIdAsc();

        for (OutboxEventEntity event : events) {
            try {
                // Redis 반영이 성공해야 반환
                outboxEventDispatcher.dispatch(event);

                // 성공한 행만 삭제
                outboxEventRepository.deleteById(event.getOutboxEventId());
            } catch(Exception e) {
                log.error(
                        "Outbox 이벤트 처리 실패, id={}, type={}",
                        event.getOutboxEventId(),
                        event.getEventType(),
                        e
                );
                try{
                    outboxRetryService.scheduleRetry(event.getOutboxEventId());
                } catch (Exception retryError) {
                    log.error(
                            "Outbox 재시도 횟수 저장 실패. id={}",
                            event.getOutboxEventId(),
                            retryError
                    );
                }
            }
        }
    }

}
