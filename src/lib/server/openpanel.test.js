import { describe, expect, it } from 'vitest';
import {
	normalizeChart,
	normalizeEvent,
	parseTimestamp,
	summarizeProfile,
	toPathname
} from './openpanel.js';

describe('openpanel', () => {
	it('liest Zeitstempel ohne Zone als UTC', () => {
		expect(parseTimestamp('2026-10-07 10:00:00.000').toISOString()).toBe(
			'2026-10-07T10:00:00.000Z'
		);
		expect(parseTimestamp('2026-10-07T10:00:00+02:00').toISOString()).toBe(
			'2026-10-07T08:00:00.000Z'
		);
	});

	it('normalisiert Ereignisse in camelCase und snake_case', () => {
		const camel = normalizeEvent({
			id: '1',
			name: 'signin',
			profileId: 'u1',
			sessionId: 's',
			createdAt: '2026-10-07 10:00:00'
		});
		const snake = normalizeEvent({
			id: '2',
			name: 'signin',
			profile_id: 'u1',
			session_id: 's',
			created_at: '2026-10-07 10:00:00'
		});
		expect(camel.profileId).toBe('u1');
		expect(snake.profileId).toBe('u1');
		expect(snake.createdAt.toISOString()).toBe('2026-10-07T10:00:00.000Z');
		expect(snake.properties).toEqual({});
	});

	it('normalisiert Chart-Reihen samt Breakdown', () => {
		const series = normalizeChart(
			{
				series: [
					{
						names: ['screen_view'],
						event: { name: 'screen_view' },
						metrics: { sum: 7 },
						data: [
							{ date: '2026-10-06T00:00:00', count: 3 },
							{ date: '2026-10-07T00:00:00', count: 4 }
						]
					},
					{ names: ['screen_view', '/belege'], data: [{ date: '2026-10-07', count: 2 }] }
				]
			},
			[{ name: 'screen_view' }]
		);
		expect(series[0]).toEqual({
			name: 'screen_view',
			total: 7,
			points: [
				{ day: '2026-10-06', value: 3 },
				{ day: '2026-10-07', value: 4 }
			]
		});
		expect(series[1].name).toBe('/belege');
		expect(series[1].total).toBe(2);
		expect(normalizeChart(null, [])).toEqual([]);
	});

	it('fasst ein Profil zusammen', () => {
		const events = [
			normalizeEvent({
				id: '1',
				name: 'screen_view',
				sessionId: 'a',
				path: 'https://app.konta.at/belege',
				browser: 'Chrome',
				city: 'Wien',
				country: 'AT',
				createdAt: '2026-10-01 10:00:00'
			}),
			normalizeEvent({
				id: '2',
				name: 'screen_view',
				sessionId: 'b',
				path: 'https://app.konta.at/belege',
				browser: 'Chrome',
				createdAt: '2026-10-03 10:00:00'
			}),
			normalizeEvent({
				id: '3',
				name: 'signin',
				sessionId: 'b',
				browser: 'Safari',
				createdAt: '2026-10-02 10:00:00'
			})
		];
		const summary = summarizeProfile(events);
		expect(summary?.sessions).toBe(2);
		expect(summary?.browsers).toEqual(['Chrome', 'Safari']);
		expect(summary?.topPages).toEqual([{ path: '/belege', value: 2 }]);
		expect(summary?.lastSeen.toISOString()).toBe('2026-10-03T10:00:00.000Z');
		expect(summarizeProfile([])).toBeNull();
		expect(toPathname('/x')).toBe('/x');
	});
});
