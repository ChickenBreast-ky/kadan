// 화면 구조와 별개로 글씨·조작 크기를 정한다. 새 화면도 이 역할을 재사용한다.
export const uiFoundationStyle=`
:root{
 --ds-font-ui:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 --ds-text-title:1.25rem;--ds-text-heading:.9375rem;--ds-text-body:.875rem;--ds-text-caption:.75rem;
 --ds-text-control:.8125rem;--ds-text-control-small:.75rem;
 --ds-weight-body:400;--ds-weight-label:600;--ds-weight-strong:700;
 --ds-leading-body:1.55;--ds-leading-control:1.4;
 --ds-control-height:2rem;--ds-control-small:1.75rem;--ds-touch-target:2.75rem;
 --ds-row-height:2.375rem;--ds-record-row-height:2.125rem;
 --ds-space-1:4px;--ds-space-2:8px;--ds-space-3:12px;--ds-space-4:16px;--ds-space-5:24px;--ds-space-6:32px;
 --ds-radius-control:5px;--ds-radius-panel:8px;
 --ds-color-page:#f5f6f7;--ds-color-surface:#fff;--ds-color-text:#202724;--ds-color-muted:#536159;
 --ds-color-border:#cbd5ce;--ds-color-action:#21684e;--ds-color-on-action:#fff;--ds-color-action-soft:#eef5f1;--ds-color-error:#9d3434;
 font-size:100%;font-family:var(--ds-font-ui);font-weight:var(--ds-weight-body);line-height:var(--ds-leading-body);
 color:var(--ds-color-text);background:var(--ds-color-page);
}
body{font-size:var(--ds-text-body)}
.dw-shell :where(button,.ds-button,.record-tabs a,.lg-pagination a){
 box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:var(--ds-space-1);
 width:fit-content;max-width:100%;min-width:var(--ds-control-height);min-height:var(--ds-control-height);height:auto;
 padding:var(--ds-space-1) var(--ds-space-3);justify-self:start;flex-shrink:0;
 font-family:var(--ds-font-ui);font-size:var(--ds-text-control);font-weight:var(--ds-weight-label);line-height:var(--ds-leading-control);
 color:var(--ds-color-text);background:var(--ds-color-surface);border:1px solid var(--ds-color-border);border-radius:var(--ds-radius-control);
 text-align:center;text-decoration:none;white-space:normal;overflow-wrap:anywhere;vertical-align:middle;cursor:pointer;
}
.dw-shell :where(button,.ds-button) strong{font-weight:var(--ds-weight-strong)}
.dw-shell :where(button,.ds-button,.record-tabs a,.lg-pagination a):hover{background:var(--ds-color-action-soft);border-color:#9bb5a6}
.dw-shell :where(button[type=submit],form button:not([type]),.ds-button--primary){background:var(--ds-color-action);border-color:var(--ds-color-action);color:var(--ds-color-on-action)}
.dw-shell :where(button[type=submit],form button:not([type]),.ds-button--primary):hover{background:#19543e}
.dw-shell :where(button,.ds-button):disabled{opacity:.5;cursor:not-allowed}
.dw-shell :where(button,.ds-button)[aria-busy=true]{cursor:progress}
.dw-shell :where(button,a,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--ds-color-action);outline-offset:2px}
.dw-shell :where(input,select,textarea){font-family:var(--ds-font-ui);font-size:var(--ds-text-control);font-weight:var(--ds-weight-body);line-height:var(--ds-leading-control);color:var(--ds-color-text)}
.dw-shell :where(input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea){min-height:var(--ds-control-height);padding:6px var(--ds-space-2);border:1px solid var(--ds-color-border);border-radius:var(--ds-radius-control);background:var(--ds-color-surface)}
.dw-shell :where(h1,.ds-title){font-size:var(--ds-text-title);font-weight:var(--ds-weight-strong);line-height:1.3}
.dw-shell :where(.ds-heading){font-size:var(--ds-text-heading);font-weight:var(--ds-weight-strong);line-height:1.4}
.dw-shell :where(.ds-caption){font-size:var(--ds-text-caption);line-height:1.5;color:var(--ds-color-muted)}

/* 기존 구성 요소를 공통 역할에 연결한다. 각 화면 CSS에는 배치만 둔다. */
.dw-shell :where(.ds-button--compact,.dw-layout button,.dd-layout button,.dw-detail-tools button,footer button,.dw-tab-panel button,.copy-question,.record-tabs a,.lg-table button,.lg-pagination a){
 min-height:var(--ds-control-small);min-width:var(--ds-control-small);font-size:var(--ds-text-control-small);padding:var(--ds-space-1) var(--ds-space-2);
}
.dw-shell :where(.dw-layout button,.dd-layout button){border-color:transparent;background:transparent;color:var(--ds-color-muted);white-space:nowrap}
.dw-shell :where(.dw-layout button,.dd-layout button)[aria-pressed=true]{background:var(--ds-color-surface);color:var(--ds-color-action);border-color:#dce5df}
.dw-shell :where(.ds-button--quiet,.df-purpose button,.df-overview button,[data-read-tab],.copy-question){
 min-height:var(--ds-control-small);min-width:var(--ds-control-small);font-size:var(--ds-text-control-small);padding:2px var(--ds-space-1);background:transparent;border-color:transparent;color:var(--ds-color-action);
}
.dw-shell :where(.dd-section-heading button){white-space:normal;text-align:right}
.dw-shell :where(.dw-tabs button){min-height:var(--ds-control-height);padding:6px 2px;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--ds-color-muted);font-size:var(--ds-text-control-small)}
.dw-shell :where(.dw-tabs button)[aria-selected=true]{border-bottom-color:var(--ds-color-action);color:var(--ds-color-action)}
.dw-shell :where(.record-tabs a)[aria-current]{background:var(--ds-color-action-soft);border-color:#9bb5a6;color:var(--ds-color-action)}
.dw-shell :where(footer button,.lg-table button){background:var(--ds-color-action-soft);color:var(--ds-color-action)}
.dw-shell :where(.dd-work-table .dd-open){width:var(--ds-control-small);padding:0;border-color:transparent;background:transparent;color:var(--ds-color-action)}
.dw-shell :where(.dd-original-head button){flex-shrink:0}
.dw-shell :where(.dw-table th button){display:block;width:100%;max-width:none;min-height:calc(var(--ds-row-height) - 1px);padding:0;border:0;border-radius:0;background:transparent;color:var(--ds-color-muted);text-align:left;font-size:var(--ds-text-control-small)}
.dw-shell :where(.dd-history-table .dd-open){width:100%;max-width:none;min-height:calc(var(--ds-record-row-height) - 1px);padding:0;border:0;border-radius:0;background:transparent;color:var(--ds-color-action);justify-content:space-between;text-align:left;font-size:var(--ds-text-control-small)}
.dw-shell :where(.dd-history-table .dd-open,.dw-table th button):focus-visible{outline-offset:-2px}

@media(pointer:coarse){
 :root{--ds-control-height:var(--ds-touch-target);--ds-control-small:var(--ds-touch-target);--ds-row-height:calc(var(--ds-touch-target) + 1px);--ds-record-row-height:calc(var(--ds-touch-target) + 1px)}
 .dw-shell :where(.dw-controls input,.dw-controls select,.dd-work-search input,input,select,textarea){font-size:max(1rem,var(--ds-text-control))}
}
`;
