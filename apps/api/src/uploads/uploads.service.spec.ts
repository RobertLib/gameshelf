import { localFileName } from './uploads.service';

/**
 * `localFileName` is the guard between a user-supplied `coverImageUrl` and
 * `unlink`. Everything it lets through is deleted from the disk, so it deserves
 * a test of its own rather than only being exercised through the endpoints.
 *
 * Two questions it answers, and both matter:
 *  - is this file ours at all? (an external link must not be touched)
 *  - is the name a plain file name? (`/uploads/../../etc/passwd` must not be)
 */
describe('localFileName', () => {
  it('accepts a plain name under our public path', () => {
    expect(localFileName('/uploads/abc-123.png')).toBe('abc-123.png');
  });

  it('ignores anything that is not ours', () => {
    // An external cover link - not our file, nothing to delete.
    expect(localFileName('https://example.com/cover.png')).toBeNull();
    expect(localFileName('http://example.com/uploads/cover.png')).toBeNull();
    // A different path on our own server.
    expect(localFileName('/static/cover.png')).toBeNull();
    // The prefix has to be followed by a slash - `/uploadsx` is not `/uploads`.
    expect(localFileName('/uploadsx/cover.png')).toBeNull();
  });

  it('treats an empty or missing value as "nothing to do"', () => {
    expect(localFileName(null)).toBeNull();
    expect(localFileName(undefined)).toBeNull();
    expect(localFileName('')).toBeNull();
    expect(localFileName('/uploads/')).toBeNull();
  });

  /**
   * The whole reason this function exists. The name is joined onto the uploads
   * directory, so a single accepted `..` would let a request delete a file
   * anywhere the process can write.
   */
  it('refuses to escape the uploads directory', () => {
    expect(localFileName('/uploads/../../etc/passwd')).toBeNull();
    expect(localFileName('/uploads/..')).toBeNull();
    expect(localFileName('/uploads/.')).toBeNull();
    expect(localFileName('/uploads/sub/dir.png')).toBeNull();
    // Windows separators are rejected too - `path.join` would honour them.
    expect(localFileName('/uploads/..\\..\\secret.env')).toBeNull();
    expect(localFileName('/uploads/dir\\file.png')).toBeNull();
  });
});
