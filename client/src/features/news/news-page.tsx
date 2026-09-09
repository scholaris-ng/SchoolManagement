import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Newspaper, Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { humanizeEnum } from '@/lib/utils';
import { useListQuery } from '@/hooks/use-list-query';
import { useNewsPosts } from './api';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import { FilterBar } from '@/components/data/filter-bar';
import { StatusBadge } from '@/components/data/status-badge';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/data/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/feedback';
import { PermissionGate } from '@/components/guards/permission-gate';

const CATEGORY_OPTIONS = [
  { value: 'NEWS', label: 'News' },
  { value: 'EVENT', label: 'Event' },
  { value: 'ACHIEVEMENT', label: 'Achievement' },
  { value: 'GALLERY', label: 'Gallery' },
];

/**
 * The school news feed.
 *
 * What parents actually open the app for between report cards: sports day
 * photographs, a prize-giving, a notice about the bus. Posts are audience-aware,
 * and student photographs respect consent (spec section 30).
 */
export function NewsPage() {
  const list = useListQuery({ filterKeys: ['category', 'status'], defaultPageSize: 12 });
  const posts = useNewsPosts(list.query);

  return (
    <PageContainer>
      <PageHeader
        title="News feed"
        description="Stories, events and photographs from around the school."
        breadcrumbs={[{ label: 'Communication' }, { label: 'News feed' }]}
        actions={
          <PermissionGate require="news.manage">
            <Button data-cy="news-new-post" asChild>
              <Link to="/news/new">
                <Plus />
                New post
              </Link>
            </Button>
          </PermissionGate>
        }
      />

      <FilterBar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search posts…"
        values={list.filters}
        onFilterChange={list.setFilter}
        onReset={list.isFiltered ? list.reset : undefined}
        filters={[
          { key: 'category', label: 'Category', options: CATEGORY_OPTIONS, allLabel: 'All posts' },
        ]}
      />

      {posts.isPending ? (
        <LoadingState label="Loading the feed…" />
      ) : posts.isError ? (
        <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
      ) : (posts.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Newspaper />}
            title={list.isFiltered ? 'Nothing matches those filters' : 'No posts yet'}
            description={
              list.isFiltered
                ? 'Try clearing the filters.'
                : 'Share what is happening at the school — parents notice when this is quiet.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.data?.items.map((post) => (
              <Card key={post.id} className="flex flex-col overflow-hidden">
                {post.coverImageUrl && (
                  <Link to={`/news/${post.id}`}>
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      className="h-40 w-full object-cover transition-opacity hover:opacity-90"
                    />
                  </Link>
                )}
                <CardContent className="flex flex-1 flex-col gap-2 pt-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="primary">{humanizeEnum(post.category)}</Badge>
                    <Badge tone="outline">{humanizeEnum(post.audience)}</Badge>
                    {post.status !== 'PUBLISHED' && <StatusBadge status={post.status} />}
                  </div>

                  <Link
                    to={`/news/${post.id}`}
                    className="font-semibold leading-snug hover:text-primary hover:underline"
                  >
                    {post.title}
                  </Link>

                  <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="truncate">
                      {post.authorName}
                      {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ''}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" aria-hidden="true" />
                        {post.likeCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="size-3" aria-hidden="true" />
                        {post.commentCount}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {posts.data?.meta && (
            <Card>
              <Pagination
                meta={posts.data.meta}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                isFetching={posts.isFetching}
              />
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
}
