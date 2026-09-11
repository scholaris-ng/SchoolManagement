import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, ShieldAlert } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useAuth } from '@/app/providers/auth-provider';
import { useNewsPost, useSaveNewsPost } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/data/status-badge';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';

export function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const post = useNewsPost(id);
  const save = useSaveNewsPost(id);

  if (post.isPending) {
    return (
      <PageContainer width="narrow">
        <PageHeader loading title="" breadcrumbs={[{ label: 'News feed', to: '/news' }]} />
        <LoadingState label="Loading post…" />
      </PageContainer>
    );
  }

  if (post.isError || !post.data) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Post" breadcrumbs={[{ label: 'News feed', to: '/news' }]} />
        <ErrorState error={post.error} onRetry={() => void post.refetch()} />
      </PageContainer>
    );
  }

  const record = post.data;
  const canManage = can('news.manage');

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={record.title}
        description={`${record.authorName}${record.publishedAt ? ` · ${formatDate(record.publishedAt)}` : ''}`}
        breadcrumbs={[{ label: 'News feed', to: '/news' }, { label: record.title }]}
        meta={
          <>
            <Badge tone="primary">{humanizeEnum(record.category)}</Badge>
            <Badge tone="outline">{humanizeEnum(record.audience)}</Badge>
            {record.status !== 'PUBLISHED' && <StatusBadge status={record.status} />}
          </>
        }
        actions={
          <>
            <Button data-cy="news-detail-back" variant="outline" onClick={() => navigate('/news')}>
              <ArrowLeft />
              Back
            </Button>
            {canManage && record.status === 'DRAFT' && (
              <Button
                data-cy="news-detail-publish"
                loading={save.isPending}
                onClick={() =>
                  void save.mutateAsync({
                    status: 'PUBLISHED',
                    publishedAt: new Date().toISOString(),
                  })
                }
              >
                Publish
              </Button>
            )}
          </>
        }
      />

      {canManage && record.containsStudentPhotos && (
        <Alert tone="warning" title="This post contains photographs of students" icon={<ShieldAlert />}>
          Only children whose guardians have recorded photo consent appear in the public version of
          this post. The rest are withheld automatically.
        </Alert>
      )}

      <Card className="overflow-hidden">
        {record.coverImageUrl && (
          <img src={record.coverImageUrl} alt="" className="max-h-80 w-full object-cover" />
        )}
        <CardContent className="space-y-4 pt-5">
          <p className="text-lg text-muted-foreground">{record.excerpt}</p>
          <div className="whitespace-pre-line text-sm leading-relaxed">{record.body}</div>

          {record.gallery.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {record.gallery.map((image) => (
                <figure key={image.id} className="overflow-hidden rounded-md border border-border">
                  <img src={image.url} alt={image.caption ?? ''} className="h-32 w-full object-cover" />
                  {image.caption && (
                    <figcaption className="p-2 text-xs text-muted-foreground">
                      {image.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Heart className="size-4" aria-hidden="true" />
              {record.likeCount} {record.likeCount === 1 ? 'like' : 'likes'}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-4" aria-hidden="true" />
              {record.commentCount} {record.commentCount === 1 ? 'comment' : 'comments'}
            </span>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
