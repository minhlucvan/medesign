import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  useStudioState, Page, Section, SectionTitle, Row, Stack, Muted, Btn, Pill, sevTone, ErrorBanner,
  HeaderBar, HeaderBrand, LoadingSkeleton,
} from './ui';
import type { DesignSystemFull } from './constants';
import type { RefinementScope } from './constants';
import { PathSelector } from './ds-create/PathSelector';
import { FromPromptForm } from './ds-create/FromPromptForm';
import { DesignMdUploadForm } from './ds-create/DesignMdUploadForm';
import { GalleryPath } from './ds-create/GalleryPath';
import { ProgressView } from './ds-create/ProgressView';
import { IntermediatePreview } from './ds-create/IntermediatePreview';
import { BrandingCard } from './ds-dashboard/BrandingCard';
import { DesignMdCard } from './ds-dashboard/DesignMdCard';
import { ColorsCard } from './ds-dashboard/ColorsCard';
import { TypographyCard } from './ds-dashboard/TypographyCard';
import { SpacingCard } from './ds-dashboard/SpacingCard';
import { MotionCard } from './ds-dashboard/MotionCard';
import { PrimitivesCard } from './ds-dashboard/PrimitivesCard';
import { RefinementStatus, type RefinementResult } from './ds-dashboard/RefinementStatus';
import { WelcomeView } from './ds-dashboard/WelcomeView';
import { SystemHero } from './ds-dashboard/SystemHero';
import { RefinementInput } from './ds-dashboard/RefinementInput';
import { BeforeAfterDiff } from './ds-dashboard/BeforeAfterDiff';

/** The "Design System" tab — single-system view with hero, section cards, inline creation, and
 *  per-scope refinement polling. Shows a Welcome screen when no system exists. */
export function DesignSystemTab() {
  const { error, refresh } = useStudioState(3000);
  const [view, setView] = useState<'loading' | 'welcome' | 'dashboard' | 'create'>('loading');
  const [detail, setDetail] = useState<DesignSystemFull | null>(null);
  const [creationMode, setCreationMode] = useState<'from-prompt' | 'gallery' | 'design-md' | null>(null);
  const [workflowSession, setWorkflowSession] = useState<string | null>(null);
  const [refinementStatus, setRefinementStatus] = useState<Record<string, 'idle' | 'refining' | 'queued' | 'success' | 'error'>>({});
  const [refinementResults, setRefinementResults] = useState<Record<string, RefinementResult | null>>({});
  const detailBeforeRefinement = useRef<string | null>(null);

  // Load the single design system on mount
  const loadSystem = useCallback(async () => {
    try {
      const r = await api.listDesignSystems();
      const targetId = r.active ?? r.systems[0]?.id;
      if (targetId) {
        const d = await api.getDesignSystemFull(targetId);
        setDetail(d);
        setView('dashboard');
        return;
      }
    } catch {
      // Offline or missing — fall through to welcome
    }
    setView('welcome');
  }, []);
  useEffect(() => { loadSystem(); }, [loadSystem]);

  // Poll for refinement completion when status is 'queued'
  useEffect(() => {
    const queuedScopes = Object.entries(refinementStatus)
      .filter(([_, s]) => s === 'queued')
      .map(([scope]) => scope);
    if (queuedScopes.length === 0 || !detail) return;

    const poll = setInterval(async () => {
      try {
        const updated = await api.getDesignSystemFull(detail.id);
        const snapshot = JSON.stringify(updated);
        // Detect when the system detail has changed from the pre-submission snapshot
        if (snapshot !== detailBeforeRefinement.current) {
          detailBeforeRefinement.current = null;
          setDetail(updated);
          setRefinementStatus((prev) => {
            const next = { ...prev };
            for (const scope of queuedScopes) next[scope] = 'success';
            return next;
          });
          setRefinementResults((prev) => {
            const next = { ...prev };
            for (const scope of queuedScopes) {
              next[scope] = { status: 'success', summary: `${scope} updated`, filesChanged: 1, tokenChanges: { added: 0, modified: 1, removed: 0 } };
            }
            return next;
          });
        }
      } catch { /* polling — will retry */ }
    }, 2000);

    return () => clearInterval(poll);
  }, [refinementStatus, detail]);

  const handleRefine = async (systemId: string, scope: RefinementScope, instruction?: string) => {
    setRefinementStatus((prev) => ({ ...prev, [scope]: 'refining' }));
    setRefinementResults((prev) => ({ ...prev, [scope]: null }));
    try {
      // Snapshot current detail before submitting so the follow-up poll can detect change
      detailBeforeRefinement.current = JSON.stringify(detail);
      await api.submitIntent({
        type: 'refine-design-system',
        instruction: instruction ?? `Update ${scope}: `,
        payload: { id: systemId, scope },
      });
      // Intent is queued — don't report success yet. Follow-up poll detects completion.
      setRefinementStatus((prev) => ({ ...prev, [scope]: 'queued' }));
    } catch (e) {
      setRefinementStatus((prev) => ({ ...prev, [scope]: 'error' }));
      setRefinementResults((prev) => ({
        ...prev,
        [scope]: { status: 'error', message: (e as Error).message },
      }));
    }
  };

  const handleRevert = async (systemId: string, scope: string) => {
    try {
      await api.revertDesignSystem(systemId);
      const updated = await api.getDesignSystemFull(systemId);
      setDetail(updated);
      setRefinementStatus((prev) => ({ ...prev, [scope]: 'idle' }));
      setRefinementResults((prev) => ({ ...prev, [scope]: null }));
    } catch (e) {
      setRefinementResults((prev) => ({
        ...prev,
        [scope]: { status: 'error', message: (e as Error).message },
      }));
    }
  };

  if (error) return <Page><ErrorBanner error={error} /></Page>;

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <Page>
        <HeaderBar>
          <HeaderBrand>Design System</HeaderBrand>
        </HeaderBar>
        <div style={{ padding: '8px 0' }}>
          <LoadingSkeleton width="40%" height={14} />
          <div style={{ height: 12 }} />
          <LoadingSkeleton height={12} />
          <div style={{ height: 4 }} />
          <LoadingSkeleton width="85%" height={12} />
          <div style={{ height: 4 }} />
          <LoadingSkeleton width="70%" height={12} />
          <div style={{ height: 4 }} />
          <LoadingSkeleton width="60%" height={12} />
        </div>
      </Page>
    );
  }

  // ── Welcome view (no systems exist) ───────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <Page>
        <WelcomeView onStart={(mode) => { setCreationMode(mode); setView('create'); }} />
      </Page>
    );
  }

  // ── Create view (inline creation flow) ────────────────────────────────────────
  if (view === 'create') {
    return (
      <Page>
        {workflowSession ? (
          <Row gap={16} style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <ProgressView
                sessionId={workflowSession}
                creationMode={creationMode === 'design-md' ? 'design-md' : creationMode === 'gallery' ? 'import-awesome' : 'from-prompt'}
                onComplete={async () => {
                  // Load system first then clear state to avoid flash of Welcome
                  await loadSystem();
                  setWorkflowSession(null);
                  setCreationMode(null);
                }}
                onError={() => {}}
              />
            </div>
            <div style={{ flex: 1 }}>
              <IntermediatePreview />
            </div>
          </Row>
        ) : creationMode === 'gallery' ? (
          <GalleryPath
            onProgress={(sessionId) => { setWorkflowSession(sessionId); }}
            onComplete={() => {
              setCreationMode(null);
              loadSystem();
            }}
          />
        ) : creationMode === 'from-prompt' ? (
          <FromPromptForm
            onProgress={(sessionId) => { setWorkflowSession(sessionId); }}
          />
        ) : creationMode === 'design-md' ? (
          <DesignMdUploadForm
            onProgress={(sessionId) => { setWorkflowSession(sessionId); }}
          />
        ) : (
          <PathSelector
            onSelect={(pathId) => {
              if (pathId === 'gallery') setCreationMode('gallery');
              else if (pathId === 'from-prompt') setCreationMode('from-prompt');
              else if (pathId === 'design-md') setCreationMode('design-md');
            }}
          />
        )}
      </Page>
    );
  }

  // ── Dashboard view ────────────────────────────────────────────────────────────
  const manifest = (detail?.manifest ?? {}) as Record<string, any>;
  const diagnostics = detail?.validation.diagnostics ?? [];
  const conflicts = detail?.conflicts ?? [];

  return (
    <Page>
      <HeaderBar>
        <HeaderBrand>Design System</HeaderBrand>
        <Btn onClick={() => setView('create')}>New</Btn>
      </HeaderBar>

      {detail && (
        <Stack gap={14}>
          {/* Hero — name, stats, color strip, font preview, quick AI input */}
          <SystemHero
            name={detail.name}
            description={manifest.description}
            category={manifest.category}
            tokens={detail.tokens}
            validationOk={detail.validation.ok}
            componentsCount={detail.components.length}
            sectionsCount={detail.sections.length}
            tokensCount={detail.tokens.length}
            onRequestChange={(text) => handleRefine(detail.id, 'all', text)}
          />

          {/* Tier 1 — expanded */}
          <Section>
            <SectionTitle>Tokens</SectionTitle>
            <ColorsCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['colors']}
            />
            <TypographyCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['typography']}
            />
          </Section>

          {/* Tier 2 — collapsed with visual */}
          <Section>
            <SectionTitle>Layout & Motion</SectionTitle>
            <SpacingCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['spacing']}
            />
            <MotionCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['motion']}
            />
            <BrandingCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['branding']}
            />
          </Section>

          {/* Tier 3 — collapsed */}
          <Section>
            <SectionTitle>Specification</SectionTitle>
            <DesignMdCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['design-md']}
            />
            <PrimitivesCard
              system={detail}
              onAction={(payload) => handleRefine(detail.id, payload.scope, payload.instruction)}
              refinementStatus={refinementStatus['primitives']}
            />
          </Section>

          {/* Refinement statuses — skip idle/queued (queued is shown by RefinementInput on each card) */}
          {Object.entries(refinementStatus).map(([scope, st]) => (
            st === 'refining' || st === 'success' || st === 'error' ? (
              <RefinementStatus
                key={scope}
                status={st}
                result={refinementResults[scope]}
                onRevert={() => handleRevert(detail.id, scope)}
              />
            ) : null
          ))}

          {/* Diagnostics — collapsed at bottom */}
          {(diagnostics.length > 0 || conflicts.length > 0) && (
            <Section>
              <SectionTitle>Diagnostics</SectionTitle>
              <Stack gap={6}>
                {diagnostics.map((d, i) => (
                  <Row key={`d${i}`} gap={8}>
                    <Pill tone={sevTone(d.severity)}>{d.severity}</Pill>
                    <Muted style={{ flex: 1 }}>{d.message}{d.where ? ` · ${d.where.file}${d.where.line ? `:${d.where.line}` : ''}` : ''}{d.fix ? ` — fix: ${d.fix}` : ''}</Muted>
                  </Row>
                ))}
                {conflicts.map((c, i) => (
                  <Row key={`c${i}`} gap={8}>
                    <Pill tone={sevTone(c.severity)}>{c.kind}</Pill>
                    <Muted style={{ flex: 1 }}>{c.message}{c.subjects?.length ? ` · ${c.subjects.join(', ')}` : ''}</Muted>
                  </Row>
                ))}
              </Stack>
            </Section>
          )}
        </Stack>
      )}
    </Page>
  );
}
