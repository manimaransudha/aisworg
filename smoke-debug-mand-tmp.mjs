import fetchCookie from 'fetch-cookie';
const base = 'http://localhost:4891';
async function login(email) {
  const fc = fetchCookie(fetch);
  const html = await (await fc(`${base}/aisworg/auth/login`)).text();
  const csrf = (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
  const res = await fc(`${base}/aisworg/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password: 'password', _csrf: csrf }), redirect: 'manual' });
  console.log('login', res.status, res.headers.get('location'));
  return fc;
}
async function main() {
  const fc = await login('template-define@athens.com');
  const res = await fc(`${base}/aisworg/seu/sdk/template-authoring/new`);
  console.log('status', res.status);
  const html = await res.text();
  console.log('length', html.length);
  console.log('has requiredCapabilityCodes:', html.includes('requiredCapabilityCodes'));
  console.log('has mandatoryPackCodes anywhere:', html.includes('mandatoryPackCodes'));
  console.log('has "Mandatory Pack" label text:', html.includes('Mandatory Pack'));
  const bodyStart = html.indexOf('<form');
  console.log(html.slice(bodyStart, bodyStart + 3000));
}
main().catch((e) => { console.error(e); process.exit(1); });
