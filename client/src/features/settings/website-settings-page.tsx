import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Plus, Save, Trash2 } from 'lucide-react';
import { env } from '@/lib/env';
import { isApiError } from '@/lib/api-error';
import { useUpdateWebsite, useWebsite } from './api';
import type { WebsiteContent } from '@/types/engagement';
import { PageContainer, PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FileUpload } from '@/components/forms/file-upload';
import { Alert, ErrorState, LoadingState } from '@/components/ui/feedback';
import { FormError, UnsavedChangesGuard } from '@/components/forms/form-actions';
import { SettingsTabs } from './settings-tabs';

const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'X', 'LinkedIn', 'YouTube', 'WhatsApp'];

/**
 * Keeps the address typeable as the school types: invalid characters collapse
 * to a single hyphen, but a trailing hyphen survives so the next keystroke
 * lands where it looks like it should.
 */
function slugifyLive(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-');
}

/** The address actually sent to the server — no leading or trailing hyphen either. */
function slugifyFinal(value: string): string {
  return slugifyLive(value).replace(/^-+|-+$/g, '');
}

/**
 * The school's public face.
 *
 * Everything here is deliberately separate from authenticated school data: the
 * public site is built from this record alone, so no student information can
 * leak onto it by accident (spec section 31). Photographs are still subject to
 * the school's consent setting before they reach a public page.
 */
export function WebsiteSettingsPage() {
  const website = useWebsite();
  const update = useUpdateWebsite();

  const [draft, setDraft] = useState<WebsiteContent | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (website.data) {
      setDraft(website.data);
      setDirty(false);
    }
  }, [website.data]);

  const headerBreadcrumbs = [{ label: 'Administration' }, { label: 'Website' }];

  if (website.isPending || !draft) {
    return (
      <PageContainer>
        <PageHeader loading title="" breadcrumbs={headerBreadcrumbs} />
        <LoadingState label="Loading website settings…" />
      </PageContainer>
    );
  }

  if (website.isError) {
    return (
      <PageContainer>
        <PageHeader title="Website" breadcrumbs={headerBreadcrumbs} />
        <ErrorState error={website.error} onRetry={() => void website.refetch()} />
      </PageContainer>
    );
  }

  const set = (patch: Partial<WebsiteContent>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  };

  const save = async () => {
    // An explicit allowlist, not "the whole record minus the fields we know
    // about": `draft` is the raw entity from the API, which also carries `id`
    // and `createdAt` that never made it into the `WebsiteContent` TS type.
    // Echoing any server-managed field back is exactly what
    // `updateWebsiteSchema`'s `.strict()` exists to catch (school.schema.ts).
    await update.mutateAsync({
      enabled: draft.enabled,
      slug: slugifyFinal(draft.slug),
      tagline: draft.tagline,
      about: draft.about,
      mission: draft.mission,
      vision: draft.vision,
      heroImageUrl: draft.heroImageUrl,
      admissionsIntro: draft.admissionsIntro,
      admissionsOpen: draft.admissionsOpen,
      contactEmail: draft.contactEmail,
      contactPhone: draft.contactPhone,
      address: draft.address,
      socialLinks: draft.socialLinks,
      testimonials: draft.testimonials,
      gallery: draft.gallery,
    });
    setDirty(false);
  };

  const fieldErrors = isApiError(update.error) ? update.error.fieldErrors() : {};
  const publicUrl = `${env.appUrl.replace(/\/$/, '')}/s/${draft.slug}`;

  return (
    <PageContainer>
      <UnsavedChangesGuard when={dirty && !update.isPending} />

      <PageHeader
        title="Website"
        description="The public profile families see before they ever sign in."
        breadcrumbs={headerBreadcrumbs}
        actions={
          <>
            <Button data-cy="settings-website-settings-preview" variant="outline" asChild>
              <a href={`/s/${draft.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                Preview
              </a>
            </Button>
            <Button data-cy="settings-website-settings-save-changes" onClick={() => void save()} loading={update.isPending} disabled={!dirty}>
              <Save />
              Save changes
            </Button>
          </>
        }
      />

      <SettingsTabs />

      {/*
        The header and tabs above take the page's full standard width, like
        every other settings screen — only this form's own content narrows.
      */}
      <div className="max-w-3xl space-y-6">
        <FormError error={update.error} />

        {!draft.enabled && (
          <Alert tone="warning" title="This website is not public">
            Turn on <strong>Publish the website</strong> below to make{' '}
            <span className="font-mono">{publicUrl}</span> live.
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Publication</CardTitle>
            <CardDescription>Where the site lives and whether it is visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Publish the website</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  When off, the public address returns nothing at all.
                </p>
              </div>
              <Switch
                data-cy="website-settings-enabled"
                checked={draft.enabled}
                onCheckedChange={(value) => set({ enabled: value })}
                aria-label="Publish the website"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-slug" required>
                Address
              </Label>
              <Input
                data-cy="site-slug"
                id="site-slug"
                value={draft.slug}
                aria-invalid={Boolean(fieldErrors.slug)}
                onChange={(event) => set({ slug: slugifyLive(event.target.value) })}
                onBlur={(event) => set({ slug: slugifyFinal(event.target.value) })}
              />
              {fieldErrors.slug ? (
                <p role="alert" className="text-xs font-medium text-danger">
                  {fieldErrors.slug}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Live at <span className="font-mono">{publicUrl}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About the school</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              preset="image"
              purpose="website-hero"
              label="Hero image"
              description="Shown across the top of the public page. Avoid photographs of identifiable students."
              value={draft.heroImageUrl ? { url: draft.heroImageUrl } : null}
              onUploaded={(file) => set({ heroImageUrl: file.downloadUrl })}
              onRemove={() => set({ heroImageUrl: null })}
            />

            <div className="space-y-1.5">
              <Label htmlFor="site-tagline">Tagline</Label>
              <Input
                data-cy="site-tagline"
                id="site-tagline"
                value={draft.tagline}
                onChange={(event) => set({ tagline: event.target.value })}
                placeholder="One line that says what the school is"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-about">About</Label>
              <Textarea
                data-cy="site-about"
                id="site-about"
                rows={5}
                value={draft.about}
                onChange={(event) => set({ about: event.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="site-mission">Mission</Label>
                <Textarea
                  data-cy="site-mission"
                  id="site-mission"
                  rows={3}
                  value={draft.mission ?? ''}
                  onChange={(event) => set({ mission: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-vision">Vision</Label>
                <Textarea
                  data-cy="site-vision"
                  id="site-vision"
                  rows={3}
                  value={draft.vision ?? ''}
                  onChange={(event) => set({ vision: event.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admissions</CardTitle>
            <CardDescription>What prospective families see and whether they can apply.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Admissions are open</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Shows an apply call-to-action on the public page.
                </p>
              </div>
              <Switch
                data-cy="website-settings-admissions-open"
                checked={draft.admissionsOpen}
                onCheckedChange={(value) => set({ admissionsOpen: value })}
                aria-label="Admissions are open"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-admissions">Admissions introduction</Label>
              <Textarea
                data-cy="site-admissions"
                id="site-admissions"
                rows={4}
                value={draft.admissionsIntro ?? ''}
                onChange={(event) => set({ admissionsIntro: event.target.value })}
                placeholder="What families should know before applying"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-email">Email</Label>
              <Input
                data-cy="site-email"
                id="site-email"
                type="email"
                value={draft.contactEmail}
                onChange={(event) => set({ contactEmail: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-phone">Phone</Label>
              <Input
                data-cy="site-phone"
                id="site-phone"
                type="tel"
                value={draft.contactPhone}
                onChange={(event) => set({ contactPhone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="site-address">Address</Label>
              <Input
                data-cy="site-address"
                id="site-address"
                value={draft.address}
                onChange={(event) => set({ address: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Social links</CardTitle>
              <CardDescription>Where else the school can be found.</CardDescription>
            </div>
            <Button
              data-cy="settings-website-settings-add-link"
              variant="outline"
              size="sm"
              onClick={() =>
                set({ socialLinks: [...draft.socialLinks, { platform: 'Facebook', url: '' }] })
              }
            >
              <Plus />
              Add link
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.socialLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No social links yet.</p>
            ) : (
              draft.socialLinks.map((link, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <div className="w-40 space-y-1.5">
                    <Label htmlFor={`social-platform-${index}`}>Platform</Label>
                    <Input
                      data-cy="website-settings-platform"
                      id={`social-platform-${index}`}
                      list="social-platforms"
                      value={link.platform}
                      onChange={(event) =>
                        set({
                          socialLinks: draft.socialLinks.map((entry, position) =>
                            position === index ? { ...entry, platform: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="min-w-[12rem] flex-1 space-y-1.5">
                    <Label htmlFor={`social-url-${index}`}>Address</Label>
                    <Input
                      data-cy="website-settings-url"
                      id={`social-url-${index}`}
                      type="url"
                      placeholder="https://"
                      value={link.url}
                      onChange={(event) =>
                        set({
                          socialLinks: draft.socialLinks.map((entry, position) =>
                            position === index ? { ...entry, url: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-cy={`website-social-remove-${index}`}
                    aria-label={`Remove ${link.platform || 'social'} link`}
                    onClick={() =>
                      set({
                        socialLinks: draft.socialLinks.filter((_, position) => position !== index),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
            <datalist id="social-platforms">
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Testimonials</CardTitle>
              <CardDescription>Quotes from parents, alumni and staff.</CardDescription>
            </div>
            <Button
              data-cy="settings-website-settings-add-testimonial"
              variant="outline"
              size="sm"
              onClick={() =>
                set({
                  testimonials: [
                    ...draft.testimonials,
                    { id: `tmp_${Date.now()}`, author: '', role: '', quote: '' },
                  ],
                })
              }
            >
              <Plus />
              Add testimonial
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.testimonials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No testimonials yet.</p>
            ) : (
              draft.testimonials.map((testimonial, index) => (
                <div key={testimonial.id} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`testimonial-author-${index}`}>Author</Label>
                      <Input
                        data-cy="website-settings-author"
                        id={`testimonial-author-${index}`}
                        value={testimonial.author}
                        onChange={(event) =>
                          set({
                            testimonials: draft.testimonials.map((entry, position) =>
                              position === index ? { ...entry, author: event.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`testimonial-role-${index}`}>Role</Label>
                      <Input
                        data-cy="website-settings-role"
                        id={`testimonial-role-${index}`}
                        value={testimonial.role}
                        placeholder="Parent, alumnus, staff…"
                        onChange={(event) =>
                          set({
                            testimonials: draft.testimonials.map((entry, position) =>
                              position === index ? { ...entry, role: event.target.value } : entry,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`testimonial-quote-${index}`}>Quote</Label>
                    <Textarea
                      data-cy="website-settings-quote"
                      id={`testimonial-quote-${index}`}
                      rows={2}
                      value={testimonial.quote}
                      onChange={(event) =>
                        set({
                          testimonials: draft.testimonials.map((entry, position) =>
                            position === index ? { ...entry, quote: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                  </div>
                  <Button
                    data-cy="settings-website-settings-remove"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set({
                        testimonials: draft.testimonials.filter((_, position) => position !== index),
                      })
                    }
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Gallery</CardTitle>
              <CardDescription>
                Images shown on the public page. Student photographs need consent on file.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              preset="image"
              purpose="website-gallery"
              label="Add an image"
              onUploaded={(file) =>
                set({
                  gallery: [
                    ...draft.gallery,
                    { id: file.storagePath, url: file.downloadUrl, caption: null },
                  ],
                })
              }
            />

            {draft.gallery.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {draft.gallery.map((image, index) => (
                  <li key={image.id} className="space-y-2">
                    <img
                      src={image.url}
                      alt={image.caption ?? ''}
                      className="aspect-video w-full rounded-md object-cover"
                    />
                    <Input
                      data-cy="website-settings-caption"
                      aria-label={`Caption for image ${index + 1}`}
                      placeholder="Caption"
                      value={image.caption ?? ''}
                      onChange={(event) =>
                        set({
                          gallery: draft.gallery.map((entry, position) =>
                            position === index ? { ...entry, caption: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                    <Button
                      data-cy="settings-website-settings-remove-2"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        set({ gallery: draft.gallery.filter((_, position) => position !== index) })
                      }
                    >
                      <Trash2 />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground">
            <Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Only what you enter on this page is served publicly. Student records, results and fees
              are never part of the public site, whatever its settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
