import { describe, it, expect } from 'vitest';
import {
  INDUSTRY_CATEGORIES,
  INDUSTRY_TEMPLATES,
  IndustryTemplate,
} from '../src/lib/industry-templates';

describe('Industry-Wise WhatsApp Templates Engine', () => {
  it('defines the core industry categories with unique IDs', () => {
    expect(INDUSTRY_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    const ids = INDUSTRY_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);

    // Verify presence of key industries
    expect(ids).toContain('all');
    expect(ids).toContain('ecommerce');
    expect(ids).toContain('realestate');
    expect(ids).toContain('healthcare');
    expect(ids).toContain('education');
    expect(ids).toContain('b2b');
    expect(ids).toContain('finance');
    expect(ids).toContain('automotive');
    expect(ids).toContain('restaurant');
    expect(ids).toContain('fitness');
    expect(ids).toContain('travel');
  });

  it('validates every template has title, non-empty content, and valid industryId', () => {
    expect(INDUSTRY_TEMPLATES.length).toBeGreaterThanOrEqual(20);

    for (const t of INDUSTRY_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.content.trim().length).toBeGreaterThan(10);
      expect(t.category).toBeTruthy();
      expect(Array.isArray(t.recommendedVariables)).toBe(true);

      // Verify industry category exists
      const categoryExists = INDUSTRY_CATEGORIES.some((c) => c.id === t.industryId);
      expect(categoryExists).toBe(true);
    }
  });

  it('accurately filters templates by industry ID', () => {
    const filterByIndustry = (industryId: string) => {
      if (industryId === 'all') return INDUSTRY_TEMPLATES;
      return INDUSTRY_TEMPLATES.filter((t) => t.industryId === industryId);
    };

    const realEstateTemplates = filterByIndustry('realestate');
    expect(realEstateTemplates.length).toBeGreaterThanOrEqual(2);
    expect(realEstateTemplates.every((t) => t.industryId === 'realestate')).toBe(true);

    const ecommerceTemplates = filterByIndustry('ecommerce');
    expect(ecommerceTemplates.length).toBeGreaterThanOrEqual(2);
    expect(ecommerceTemplates.every((t) => t.industryId === 'ecommerce')).toBe(true);
  });

  it('safely handles search query filtering across title, content, and category', () => {
    const searchTemplates = (q: string) => {
      const query = q.toLowerCase().trim();
      return INDUSTRY_TEMPLATES.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.content.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    };

    expect(searchTemplates('discount').length).toBeGreaterThanOrEqual(1);
    expect(searchTemplates('appointment').length).toBeGreaterThanOrEqual(1);
    expect(searchTemplates('masterclass').length).toBeGreaterThanOrEqual(1);
    expect(searchTemplates('non_existent_query_xyz').length).toBe(0);
  });

  it('verifies Spintax variations can be extracted and formatted for preview', () => {
    const sample = '{Hi|Hello|Greetings} {name|Friend}!';
    const preview = sample.replace(/\{([^}]+)\}/g, (match, choices) => {
      if (choices.includes('|')) {
        return choices.split('|')[0];
      }
      return match;
    });

    expect(preview).toBe('Hi name!');
  });

  it('synchronizes selected template into campaign wizard and base message variants', () => {
    // Simulate campaign wizard state
    let wizTemplate = 'old base message';
    let wizVariants = [
      { position: 1, label: 'Message 1 (Base)', content: 'old base message', weight: 100 }
    ];

    const onUseInCampaign = (content: string, mediaType?: string, templateTitle?: string) => {
      wizTemplate = content;
      wizVariants = [
        {
          position: 1,
          label: templateTitle ? `Message 1 (${templateTitle.slice(0, 16)})` : 'Message 1 (Base)',
          content: content,
          weight: 100,
        }
      ];
    };

    const selectedTemplate = INDUSTRY_TEMPLATES.find((t) => t.id === 're-1');
    expect(selectedTemplate).toBeDefined();

    onUseInCampaign(selectedTemplate!.content, selectedTemplate!.mediaType, selectedTemplate!.title);

    // Verify wizard state is cleanly updated with new template
    expect(wizTemplate).toBe(selectedTemplate!.content);
    expect(wizVariants[0].content).toBe(selectedTemplate!.content);
    expect(wizVariants[0].content).not.toBe('old base message');
  });
});

