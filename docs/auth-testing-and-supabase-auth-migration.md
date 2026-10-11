# اختبار المصادقة والانتقال إلى Supabase Auth

## 1. إنشاء مستخدم تجريبي في `public.users`

الـ backend الحالي لا يستخدم `auth.users` في Supabase. هو يستخدم جدول `public.users` المخصص ويجري التحقق من كلمة المرور عبر Node.js `crypto.scryptSync`.

السكربت التالي يطابق الخوارزمية الحالية، وينشئ الشركة تلقائيًا، ثم يعمل `upsert` للمستخدم داخل transaction:

[`scripts/create-test-user.mjs`](../scripts/create-test-user.mjs)

### تشغيل آمن

من داخل المشروع:

```bash
cd /home/ubuntu/ABDULKAREM-Live-MEETING
export DATABASE_URL='postgresql://USER:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
export TEST_USER_PASSWORD='ضع-كلمة-مرور-اختبارية-قوية-هنا'
node scripts/create-test-user.mjs \
  --email test@example.com \
  --name 'Test Participant' \
  --company-id demo-company \
  --company-name 'Demo Company' \
  --site-id demo-site \
  --role participant
unset DATABASE_URL TEST_USER_PASSWORD
```

بدلًا من `TEST_USER_PASSWORD` يمكن تشغيل السكربت دونها، وسيطلب كلمة المرور تفاعليًا مع إخفاء الإدخال:

```bash
DATABASE_URL='postgresql://USER:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' \
node scripts/create-test-user.mjs --email test@example.com --role participant
```

> لا تضع `DATABASE_URL` أو كلمة المرور في Git أو في الواجهة الأمامية. استخدم Transaction Pooler، ولا تستخدم `service_role` في المتصفح.

### ما يفعله السكربت

- ينشئ salt عشوائيًا بطول 16 بايت.
- يحسب `scrypt(password, salt, 64)` ويخزن الناتج بصيغة hex.
- يكتب `password_hash` و`salt` في `public.users`.
- يضمن وجود الشركة في `public.companies`.
- لا يطبع كلمة المرور أو hash أو salt.
- لا يمنح المستخدم دورًا أعلى من القيمة التي تمررها صراحة.

## 2. اختبار العملية كاملة بعد إصلاح CORS

### أ. اختبار اتصال قاعدة البيانات

```bash
DATABASE_URL='postgresql://USER:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' \
node - <<'JS'
const pg = require('pg');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});
(async () => {
  try {
    const result = await pool.query('select count(*)::int as count from public.users');
    console.log({ users: result.rows[0].count });
  } finally {
    await pool.end();
  }
})();
JS
```

### ب. اختبار CORS من نطاق Vercel

```bash
curl -i -X OPTIONS \
  'https://abdulkarem-live-meeting.onrender.com/api/auth/login' \
  -H 'Origin: https://abdulkarem-live-meeting.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

النتيجة المتوقعة:

- HTTP `204`
- `access-control-allow-origin: https://abdulkarem-live-meeting.vercel.app`

إذا ظهر `403 Origin not allowed`، أضف النطاق الفعلي في Render ضمن `ALLOWED_ORIGINS` دون `/` في النهاية.

### ج. اختبار login عبر API

```bash
curl -i -X POST \
  'https://abdulkarem-live-meeting.onrender.com/api/auth/login' \
  -H 'Origin: https://abdulkarem-live-meeting.vercel.app' \
  -H 'Content-Type: application/json' \
  --data '{"email":"test@example.com","password":"كلمة-الاختبار"}'
```

النجاح يعيد HTTP `200` وكائن `user` يحتوي على `token`. لا تنشر token في المحادثة أو السجلات.

النتائج الشائعة:

| النتيجة | المعنى | الإجراء |
|---|---|---|
| `200` | الاتصال والمستخدم وكلمة المرور صحيحة | انتقل لاختبار الواجهة والاجتماع |
| `401 Invalid email or password` | المستخدم غير موجود أو كلمة المرور لا تطابق salt/hash | أعد تشغيل سكربت الإنشاء أو تحقق من البريد |
| `403 Origin not allowed` | نطاق Vercel غير موجود في Render | حدّث `ALLOWED_ORIGINS` ثم أعد النشر |
| `503 Authentication database unavailable` | فشل اتصال PostgreSQL أو الاستعلام | راجع `DATABASE_URL` وTransaction Pooler وSSL وسجلات Render |
| `429` | تجاوز rate limit | انتظر ثم أعد الاختبار باعتدال |

### د. اختبار الواجهة

1. افتح `https://abdulkarem-live-meeting.vercel.app`.
2. افتح شاشة الانضمام ثم زر **تسجيل الدخول**.
3. استخدم نفس البريد وكلمة المرور اللذين أدخلهما السكربت.
4. تأكد من اختفاء `Failed to fetch` وظهور الحساب المسجل.
5. افتح DevTools → Network وتحقق من أن الطلب يذهب إلى:
   `https://abdulkarem-live-meeting.onrender.com/api/auth/login`
6. تأكد من أن الاستجابة HTTP `200` وأنه لا توجد أخطاء CORS في Console.

### هـ. اختبار الاجتماع

- مستخدم `participant` لا ينشئ غرفة جديدة.
- أنشئ مستخدمًا تجريبيًا منفصلًا بدور `host` لاختبار إنشاء الغرفة.
- سجّل دخول المضيف، أنشئ غرفة، وأنشئ دعوة للمشارك.
- افتح نافذة خاصة/متصفحًا آخر، سجّل دخول المشارك أو استخدم دعوة صالحة، ثم اختبر WebSocket والكاميرا والصوت.

## 3. دعم Supabase Auth مباشرة

### الوضع الحالي

حاليًا توجد هويتان منفصلتان:

1. `auth.users` — هوية Supabase Auth.
2. `public.users` — الهوية التي يعتمد عليها backend الحالي، وفيه `password_hash` و`salt`.

إنشاء مستخدم من Supabase Dashboard وحده لا يكفي للنظام الحالي؛ لأن route login يبحث في `public.users`.

### التصميم الموصى به

اجعل Supabase Auth هو مصدر الهوية وكلمة المرور، واحتفظ بجدول ملف شخصي/مؤسسي بلا كلمات مرور:

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
```

يفضل على المدى الطويل إعادة تسمية الجدول إلى `user_profiles` أو إنشاء جدول جديد:

```sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name varchar(128) NOT NULL,
  role user_role NOT NULL DEFAULT 'participant',
  company_id varchar(128) NOT NULL REFERENCES public.companies(id),
  site_id varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### مراحل انتقال آمنة

1. **إضافة الربط:** أضف `auth_user_id` أو جدول `user_profiles` دون حذف الحقول القديمة.
2. **إنشاء مستخدمي Auth:** استخدم Supabase Admin API من backend فقط، وليس من المتصفح.
3. **ربط الملف المؤسسي:** بعد إنشاء مستخدم Auth، أدخل `auth_user_id` والدور والشركة والموقع في `user_profiles`.
4. **تعديل الواجهة:** استخدم `@supabase/supabase-js` و`signInWithPassword` و`signUp`. ضع فقط `SUPABASE_URL` و`SUPABASE_ANON_KEY` في الواجهة.
5. **تعديل backend:** تحقق من Bearer token عبر Supabase Auth (`supabase.auth.getUser(token)`) أو تحقق من JWT عبر JWKS. لا تقبل claims غير موثقة من العميل.
6. **اشتقاق الصلاحيات:** اقرأ الدور والشركة من `user_profiles` بعد التحقق من هوية Auth. لا تجعل العميل يحدد `role` أو `companyId`.
7. **WebSocket:** عند الاتصال، أرسل Supabase access token في رسالة `auth-token`، ثم تحقق منه على الخادم قبل السماح بالانضمام.
8. **RLS:** عدّل السياسات لاستخدام `auth.uid()` وربط الملف الشخصي بالشركة، أو استخدم Custom Access Token Hook لإضافة claims معتمدة مثل `company_id` و`role`.
9. **التوافق المرحلي:** خلال فترة الانتقال، اسمح بمسار legacy فقط للحسابات القديمة، واسمح بمسار Supabase Auth للمستخدمين الجدد. سجّل استخدام legacy للمراقبة.
10. **الإيقاف:** بعد نقل كل الحسابات واختبار WebSocket والاجتماعات، أوقف التحقق من `password_hash` و`salt` ثم احذفهما في migration منفصلة بعد نسخة احتياطية.

### مثال backend مختصر لمسار Auth الجديد

```ts
const { data: { user }, error } = await supabase.auth.getUser(accessToken);
if (error || !user) return res.status(401).json({ error: 'Authentication required' });

const profile = await getUserProfileByAuthId(user.id);
if (!profile) return res.status(403).json({ error: 'User profile is not provisioned' });

// الصلاحيات تُشتق من profile، لا من body أو claims غير موثقة.
```

استخدم Service Role Key لهذا الاستدعاء على الخادم فقط إذا كان ذلك مطلوبًا، ولا ترسله إلى Vercel frontend أو إلى المستخدم.

### قرار معماري مهم

لا أنصح بإنشاء JWT مخصص جديد فوق Supabase Auth إلا كحل انتقالي. الأفضل أن يتعامل REST وWebSocket مع Supabase access token نفسه، وأن تكون الصلاحيات في `user_profiles` وRLS. هذا يقلل ازدواجية الجلسات، ويجعل تسجيل الخروج وتدوير الرموز وإلغاء الجلسات متسقًا مع Supabase.
