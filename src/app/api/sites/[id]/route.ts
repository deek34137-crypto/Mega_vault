import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSavedSiteById, deleteSavedSite, getAllSavedSiteVideos } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const site = await getSavedSiteById(id);
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const videos = await getAllSavedSiteVideos(undefined, id);

  return NextResponse.json({
    success: true,
    site,
    videos,
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const site = await getSavedSiteById(id);
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  await deleteSavedSite(id);

  return NextResponse.json({
    success: true,
    message: `Site "${site.nickname}" deleted successfully.`,
  });
}
