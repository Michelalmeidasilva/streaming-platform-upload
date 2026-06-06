import { NextRequest, NextResponse } from 'next/server';
import { IntegrationConfig } from '@/types';
import { integrationLayer } from '@/lib/integration';
import { getCurrentSession } from '@/lib/auth/session';
import { canEditVideo } from '@/lib/auth/permissions';
import { withEmf } from '@/lib/telemetry/emf';

async function postHandler(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canEditVideo(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, config, event, videoId, data } = body;

    switch (action) {
      case 'register': {
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration required' },
            { status: 400 }
          );
        }

        const integrationConfig: IntegrationConfig = {
          name: config.name,
          type: config.type,
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          enabled: config.enabled ?? true,
        };

        integrationLayer.register(integrationConfig);

        return NextResponse.json({
          success: true,
          message: `Integration "${config.name}" registered`,
        });
      }

      case 'notify': {
        if (!event || !videoId) {
          return NextResponse.json(
            { error: 'Event and videoId required' },
            { status: 400 }
          );
        }

        await integrationLayer.notify(event, videoId, data || {});

        return NextResponse.json({
          success: true,
          message: 'Notification sent',
        });
      }

      case 'test': {
        if (!config?.name) {
          return NextResponse.json(
            { error: 'Integration name required' },
            { status: 400 }
          );
        }

        const connected = await integrationLayer.testConnection(config.name);

        return NextResponse.json({
          success: connected,
          message: connected ? 'Connection successful' : 'Connection failed',
        });
      }

      case 'list': {
        const connectors = integrationLayer.getConnectors();

        return NextResponse.json({
          connectors,
        });
      }

      case 'remove': {
        if (!config?.name) {
          return NextResponse.json(
            { error: 'Integration name required' },
            { status: 400 }
          );
        }

        integrationLayer.remove(config.name);

        return NextResponse.json({
          success: true,
          message: `Integration "${config.name}" removed`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Integration error:', error);
    return NextResponse.json(
      { error: 'Integration failed' },
      { status: 500 }
    );
  }
}

export const POST = withEmf('/api/integrate', postHandler);
