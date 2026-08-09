import { NextResponse } from 'next/server';
import { getAlbumById, deleteAlbum } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const album = await getAlbumById(id);
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

  return NextResponse.json({ album });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const album = await getAlbumById(id);
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

  const deleted = await deleteAlbum(id);
  if (!deleted) return NextResponse.json({ error: 'Failed to delete album' }, { status: 500 });

  return NextResponse.json({ success: true });
}
