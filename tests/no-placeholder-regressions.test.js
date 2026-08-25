import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const readSource = (relativePath) => readFileSync(resolve(sourceRoot, relativePath), 'utf8');

describe('placeholder and mock behavior regressions', () => {
  it('keeps onboarding templates backed by persisted entity data', () => {
    const source = readSource('components/cs/OnboardingWidget.jsx');

    expect(source).toContain('atlas.entities.OnboardingTemplate.list()');
    expect(source).not.toContain('ONBOARDING_TEMPLATES');
    expect(source).not.toContain('Mock Data Structure');
  });

  it('does not reintroduce hardcoded marketing examples', () => {
    const source = readSource('pages/MarketingTemplates.jsx');

    expect(source).not.toContain('MOCK_TEMPLATES');
    expect(source).not.toContain('Acme Corp');
    expect(source).toContain('atlas.entities.MarketingTemplate.list()');
  });

  it('does not expose a dashboard customization control without persistence', () => {
    const source = readSource('pages/Dashboard.jsx');

    expect(source).not.toContain('AddWidgetDialog');
    expect(source).not.toContain('tempWidgets');
    expect(source).not.toContain('CustomWidget');
  });

  it('routes the fallback home page into the real application', () => {
    const source = readSource('pages/Home.jsx');

    expect(source).toContain("import { Navigate } from 'react-router-dom';");
    expect(source).toContain('<Navigate to="/Dashboard" replace />');
    expect(source).not.toContain('<div>\n    </div>');
  });

  it('does not describe live access as a demo environment', () => {
    const source = readSource('components/dashboard/SecurityInfoModal.jsx');

    expect(source).not.toContain('Demo Security Protocols');
    expect(source).not.toContain('secured demo environment');
  });
});
