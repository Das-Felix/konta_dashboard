import { describe, expect, it } from 'vitest';
import { buildTimeline, collapseEvents, groupByDay, parseAuditChanges } from './timeline.js';

/**
 * @param {Partial<import('./server/openpanel.js').OpenPanelEvent>} overrides
 * @returns {import('./server/openpanel.js').OpenPanelEvent}
 */
function event(overrides) {
	return {
		id: 'e',
		name: 'screen_view',
		profileId: 'u1',
		sessionId: 's1',
		deviceId: null,
		createdAt: new Date('2026-10-07T10:00:00Z'),
		path: 'https://app.konta.at/belege',
		origin: null,
		referrer: null,
		referrerName: null,
		country: 'AT',
		city: 'Wien',
		os: 'macOS',
		browser: 'Chrome',
		device: 'desktop',
		duration: null,
		properties: {},
		...overrides
	};
}

describe('timeline', () => {
	it('schlüsselt Audit-Diffs auf und ignoriert Snapshots', () => {
		expect(
			parseAuditChanges({ city: { from: null, to: 'Graz' }, paid: { from: false, to: true } })
		).toEqual([
			{ field: 'city', from: 'leer', to: 'Graz' },
			{ field: 'paid', from: 'nein', to: 'ja' }
		]);
		expect(parseAuditChanges({ name: 'Snapshot' })).toEqual([]);
		expect(parseAuditChanges(null)).toEqual([]);
	});

	it('fasst Seitenaufrufe einer Session zusammen', () => {
		const items = collapseEvents([
			event({
				id: 'a',
				createdAt: new Date('2026-10-07T10:00:00Z'),
				path: 'https://app.konta.at/belege'
			}),
			event({
				id: 'b',
				createdAt: new Date('2026-10-07T10:02:00Z'),
				path: 'https://app.konta.at/rechnungen'
			}),
			event({
				id: 'c',
				name: 'receipt_uploaded',
				createdAt: new Date('2026-10-07T10:03:00Z'),
				properties: { count: 2, __ts: 'x' }
			}),
			event({ id: 'd', createdAt: new Date('2026-10-07T11:30:00Z'), path: 'https://app.konta.at/' })
		]);
		expect(items.map((item) => item.title)).toEqual([
			'2 Seiten aufgerufen',
			'Beleg hochgeladen',
			'Seite aufgerufen: /'
		]);
		expect(items[0].detail).toBe('/belege, /rechnungen');
		expect(items[1].detail).toBe('count: 2');
	});

	it('mischt alle Quellen absteigend nach Zeit', () => {
		const items = buildTimeline({
			user: {
				createdAt: new Date('2026-10-01T08:00:00Z'),
				emailVerifiedAt: new Date('2026-10-01T08:05:00Z'),
				onboardingCompletedAt: null
			},
			audit: [
				{
					id: 'l1',
					createdAt: new Date('2026-10-03T09:00:00Z'),
					entityType: 'invoice',
					action: 'issue',
					summary: 'Rechnung R-2026-001 ausgestellt',
					userId: 'u1',
					actorFirstName: 'Anna',
					actorLastName: 'Gruber',
					changes: null
				}
			],
			logins: [
				{
					id: 'x',
					createdAt: new Date('2026-10-02T07:00:00Z'),
					success: false,
					result: 'INVALID_CREDENTIALS',
					stage: 'PASSWORD',
					ipAddress: '1.2.3.4'
				}
			],
			events: [event({ id: 'z', name: 'signin', createdAt: new Date('2026-10-04T07:00:00Z') })]
		});
		expect(items.map((item) => item.source)).toEqual([
			'nutzung',
			'protokoll',
			'login',
			'konto',
			'konto'
		]);
		expect(items[1].meta).toEqual(['Beleg / Rechnung', 'Ausgestellt', 'Anna Gruber']);
		expect(items[2].tone).toBe('error');
	});

	it('gruppiert nach Tag', () => {
		const items = buildTimeline({
			user: {
				createdAt: new Date('2026-10-01T08:00:00Z'),
				emailVerifiedAt: new Date('2026-10-01T09:00:00Z'),
				onboardingCompletedAt: new Date('2026-10-02T09:00:00Z')
			}
		});
		const groups = groupByDay(items, (date) => date.toISOString().slice(0, 10));
		expect(groups.map((group) => [group.day, group.items.length])).toEqual([
			['2026-10-02', 1],
			['2026-10-01', 2]
		]);
	});
});
