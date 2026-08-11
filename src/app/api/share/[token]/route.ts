import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getShareLinkByToken, getAlbumById, deleteShareLink } from '@/lib/db';
import { fetchMegaFolderMedia } from '@/lib/mega';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const providedPin = searchParams.get('pin') || '';

    const link = await getShareLinkByToken(token);
    if (!link) {
      return NextResponse.json({ error: 'Share link not found or has been revoked' }, { status: 404 });
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    if (link.pin_hash) {
      if (!providedPin) {
        return NextResponse.json(
          { isPinRequired: true, error: 'PIN protection enabled for this link' },
          { status: 401 }
        );
      }
      const hashedProvided = crypto.createHash('sha256').update(providedPin.trim()).digest('hex');
      if (hashedProvided !== link.pin_hash) {
        return NextResponse.json(
          { isPinRequired: true, error: 'Incorrect PIN' },
          { status: 401 }
        );
      }
    }

    const album = await getAlbumById(link.album_id);
    if (!album || !album.mega_link) {
      return NextResponse.json({ error: 'Shared album no longer exists' }, { status: 404 });
    }

    const mediaResult = await fetchMegaFolderMedia(album.id, album.mega_link, link.subfolder_path || undefined);

    // Append shareToken parameter to streamUrl for each media item
    const items = (mediaResult.items || []).map((item) => ({
      ...item,
      streamUrl: `${item.streamUrl}&shareToken=${token}`,
    }));

    return NextResponse.json({
      success: true,
      album: {
        id: album.id,
        title: album.title,
        description: album.description,
        createdAt: album.created_at,
      },
      subfolderPath: link.subfolder_path || '',
      items,
      subfolders: mediaResult.subfolders || [],
      mediaCount: mediaResult.mediaCount,
      token,
    });
  } catch (error) {
    console.error('Error fetching share link media:', error);
    return NextResponse.json({ error: 'Failed to load shared media' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { token } = await params;
    const success = await deleteShareLink(token);
    return NextResponse.json({ success });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 });
  }
}
