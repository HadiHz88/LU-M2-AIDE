# DVC with Azure Blob Storage: solution guide

You version a dataset with DVC: Git stores small pointer files, and the data itself goes to an
Azure Blob Storage container shared by the class. Then you save two versions of a small CSV and
switch between them.

**Starting point:** the handout is `DVC-with-Azure-Blob-Storage.pdf` and the starter is
`starter.zip` (the teacher's `mlflow-with-daghub.zip`). The course reuses that project folder for
the MLflow assignment, which is why it is named after MLflow. Here only `data/raw_dataset.csv`
matters; `MLFlowSetup.ipynb` is for the next assignment. There is no `solution/` folder: this guide
holds every command.

**What was checked:** every command below was run with DVC 3.67.1 and Git on a MacBook with Apple
silicon, with a local folder standing in for the Azure container. The DVC messages shown are the
real ones, including a `dvc pull` from a fresh clone. The Azure side itself (logging in with the
SAS token, the container's contents) was not run.

**Credentials:** the SAS token is a secret. It never goes into a file that Git tracks. In this
guide it is written `<SAS_TOKEN>`; use the one your teacher gave you. The handout says the token is
valid until 12 December 2026, but the token it prints expires on 31 December 2026 (its `se=`
field); the earlier date belongs to an older token.

## 1. Install DVC

Git must already be installed. The Azure remote needs the `azure` extra, so install it from the
start (the plain `dvc` package cannot talk to Azure):

```bash
python -m pip install -U "dvc[azure]"
dvc --version
```

The version printed here was `3.67.1`.

## 2. Set up the project

The starter already contains a `.dvc` folder, so the project is initialised for DVC, and the
dataset is already tracked (`data/raw_dataset.csv.dvc` and `data/.gitignore` are there). Do not run
`dvc init` again: it stops with `ERROR: failed to initiate DVC - '.dvc' exists. Use -f to force.`
Only Git is missing:

```bash
cd mlflow-with-daghub
git init
dvc status
```

```text
Data and pipelines are up to date.
```

That message confirms DVC found the CSV and that its content matches the pointer.

If you start from an empty folder instead, do `git init` and then `dvc init`, as the handout says.
`dvc init` creates the `.dvc` folder and tells you to commit it.

## 3. Add the dataset to DVC

The dataset is `data/raw_dataset.csv` (about 23 MB, 104 613 rows). The starter already went
through this step, so the command below changes nothing here; it is what you would do in a project
of your own:

```bash
dvc add data/raw_dataset.csv
```

DVC moves the file's content into its cache and creates two small files next to it:

```text
data/raw_dataset.csv.dvc     the pointer, tracked by Git
data/.gitignore              contains /raw_dataset.csv so Git never sees the big file
```

The pointer holds the content hash, not the data:

```yaml
outs:
- md5: 42171ec985af1d3aed38f4d6f497030b
  size: 23324132
  hash: md5
  path: raw_dataset.csv
```

If your hash differs, the CSV was changed after it was downloaded. Commit the pointer. Because the
starter has no Git history yet, add the `.dvc` folder (its `config` and `.gitignore`) as well:

```bash
git add data/raw_dataset.csv.dvc data/.gitignore .dvc .dvcignore
git commit -m "Add raw dataset to DVC"
```

The CSV is still on disk where you left it; it is only ignored by Git. `git status` still lists
`MLFlowSetup.ipynb` as untracked. Leave it, or commit it: this assignment does not use it.

## 4. Configure the Azure remote

The handout shows three kinds of remote. Amazon S3 and Google Drive are examples only; the class
uses Azure. The storage account is `wut2026`, the container is `dvc` and the remote is named
`myazure`:

```bash
dvc remote add -d myazure azure://dvc
dvc remote modify myazure account_name wut2026
dvc remote modify --local myazure sas_token "<SAS_TOKEN>"
```

- **In the starter, `dvc remote add` fails**, because `.dvc/config` already defines `myazure`:
  `ERROR: configuration error - config file error: remote 'myazure' already exists. Use -f|--force
  to overwrite it.` This is expected (the handout mentions it: "If the remote `myazure` already
  exists, update its URL instead"). Skip that line, or run `dvc remote modify myazure url
  azure://dvc`; the two `modify` lines work as written. Only the token is really new, because the
  starter has no `config.local`.
- `-d` makes `myazure` the default remote, so `dvc push` and `dvc pull` need no `-r`.
- `azure://dvc` is the container, not the whole URL. DVC finds the account from `account_name`,
  which is required even when you log in with a SAS token. Without it `dvc push` fails with
  `Authentication to Azure Blob Storage requires either account_name or connection_string`.
- `--local` writes the token to `.dvc/config.local`, which DVC already lists in
  `.dvc/.gitignore`. Everything else goes to `.dvc/config`, which is committed.

The two files end up like this:

```ini
# .dvc/config (committed)
[core]
    remote = myazure
['remote "myazure"']
    url = azure://dvc
    account_name = wut2026

# .dvc/config.local (never committed)
['remote "myazure"']
    sas_token = <SAS_TOKEN>
```

The starter's `.dvc/config` also lists a leftover `myremote` remote, from the handout's S3 example.
It is never used, because `myazure` is the default; you can remove it with
`dvc remote remove myremote`.

Check the setup:

```bash
dvc remote list
dvc config remote.myazure.account_name
```

```text
myremote        s3://mybucket/path
myazure azure://dvc     (default)
wut2026
```

In the starter, `git status` shows no change to `.dvc/config` after these commands: the values
were already there and were committed in section 3. In a project of your own, `.dvc/config` is now
modified. The handout never says to commit it, but a classmate who clones the project needs the
remote's URL, so commit it. Check first that no token is inside:

```bash
git diff .dvc/config
git add .dvc/config
git commit -m "Configure the Azure remote"
```

Upload the dataset:

```bash
dvc push
```

```text
1 file pushed
```

In the container, the blob is `files/md5/42/171ec985af1d3aed38f4d6f497030b`: DVC names each object
after its content hash, the first two characters being the folder. The container is shared, so the
same object may already be there from a classmate. In that case DVC prints
`Everything is up to date.`, and that is a success, not a problem. Running `dvc push` a second time
prints the same message.

## 5. Share the project

```bash
git remote add origin <repository_url>
git push -u origin main
```

Only the pointers and the config travel through Git. Whoever clones the repository gets
`raw_dataset.csv.dvc` but not the CSV. They add their own token (it is not in the repository),
then pull:

```bash
git clone <repository_url>
cd mlflow-with-daghub
dvc remote modify --local myazure sas_token "<SAS_TOKEN>"
dvc pull
```

The end of section 7 shows what that pull prints.

## 6. Track a change

After editing `data/raw_dataset.csv`, `dvc status` reports it as modified. Save the new version
with these four commands, in this order:

```bash
dvc add data/raw_dataset.csv
git add data/raw_dataset.csv.dvc
git commit -m "Update dataset"
dvc push
```

**The handout's `git add` line is wrong.** It writes `git add data/.gitignore raw_dataset.csv.dvc`,
which fails with `fatal: pathspec 'raw_dataset.csv.dvc' did not match any files`, because the
pointer sits in `data/`. Adding `data/.gitignore` again is harmless but not needed: it only changes
when a new file is tracked.

`dvc add` rewrites the pointer with the new hash; `git commit` records that version; `dvc push`
uploads the new content. Forgetting `dvc push` is the usual mistake: the commit exists, but a
classmate's `dvc pull` cannot find the data.

## 7. Hands-on: compare two dataset versions

The handout uses a tiny CSV so the real dataset stays untouched.

**Version 1.** Create it, track it, commit the pointer, tag it, upload it:

```bash
mkdir -p data
printf 'id,score\n1,80\n2,90\n' > data/dvc_demo.csv
dvc add data/dvc_demo.csv
git add data/dvc_demo.csv.dvc data/.gitignore
git commit -m "Add demo dataset version 1"
git tag dvc-demo-v1
dvc push
```

`data/.gitignore` is added here because `dvc add` appended `/dvc_demo.csv` to it. The pointer
holds `md5: f7b1510e29cd5937f597758753024eaf` and `size: 19`, and `dvc push` prints
`1 file pushed`.

**Version 2.** Append a record. `dvc status` sees the change without any Git involved:

```bash
printf '3,95\n' >> data/dvc_demo.csv
dvc status
```

```text
data/dvc_demo.csv.dvc:
	changed outs:
		modified:           data/dvc_demo.csv
```

```bash
dvc add data/dvc_demo.csv
git add data/dvc_demo.csv.dvc
git commit -m "Add demo dataset version 2"
git tag dvc-demo-v2
dvc push
```

Now the pointer holds `md5: 99ad5820330fc57b44cd0cfb79f2eefa` and `size: 24`. These two hashes
depend only on the file content, so you should get exactly the same ones. If you do not, a trailing
space or a different line ending crept into the file.

**Inspect the two versions.**

```bash
git log --oneline -- data/dvc_demo.csv.dvc
git diff dvc-demo-v1 dvc-demo-v2 -- data/dvc_demo.csv.dvc
```

```text
d539f25 Add demo dataset version 2
640cafc Add demo dataset version 1

-- md5: f7b1510e29cd5937f597758753024eaf
-  size: 19
+- md5: 99ad5820330fc57b44cd0cfb79f2eefa
+  size: 24
```

Git shows a changed hash, never changed CSV rows: Git versions the pointer, DVC versions the
content (in its cache and in Azure). Your commit hashes will differ from the ones above.

**Switch between versions.** Run these in one terminal so `ORIGINAL_BRANCH` survives. Commit any
edit first, because `dvc pull` replaces the data file:

```bash
ORIGINAL_BRANCH="$(git branch --show-current)"

git switch --detach dvc-demo-v1
dvc pull
cat data/dvc_demo.csv
```

```text
M       data/dvc_demo.csv
1 file modified
id,score
1,80
2,90
```

```bash
git switch --detach dvc-demo-v2
dvc pull
cat data/dvc_demo.csv
```

```text
M       data/dvc_demo.csv
1 file modified
id,score
1,80
2,90
3,95
```

```bash
git switch "$ORIGINAL_BRANCH"
dvc pull
```

```text
Everything is up to date.
```

The last `dvc pull` has nothing to do because version 2 is already in the folder. The idea to keep:
`git switch` only changes which pointer file is checked out; `dvc pull` then puts the matching data
in place. Here it found both versions in the local cache, so nothing was downloaded. `--detach`
means you are on a tag rather than a branch, so do not commit there.

**Check from a fresh clone.** This is the real test that the remote holds everything. A clone has
only the pointers in `data/`; after adding the token, `dvc pull` downloads both files:

```text
A       data/dvc_demo.csv
A       data/raw_dataset.csv
2 files fetched and 2 files added
```

and `dvc status` then prints `Data and pipelines are up to date.`

## 8. Clean up with `dvc gc`

The handout writes `dvc gc` alone. That fails, because DVC wants to know what to keep:

```text
ERROR: Either of `-w|--workspace`, `-a|--all-branches`, `-T|--all-tags` `--all-experiments`,
`--all-commits`, `--date` or `--rev` needs to be set.
```

Use one of these. Each asks `Are you sure you want to proceed? [y/n]` first; add `-f` to skip the
question.

| Command | Keeps | Effect |
|---|---|---|
| `dvc gc -w` | what the current workspace uses | removes older versions from the **local cache** only |
| `dvc gc -T` | what the workspace and every tag use | removes only versions nothing refers to |
| `dvc gc -w -c` | the same as `-w` | also deletes from the **remote** |

Here `dvc gc -T` printed `No unused 'repo' cache to remove.`, because both tags still point at a
version. `dvc gc -w` printed `Removed 1 objects from repo cache.`: the version-1 data was gone from
the local cache. Switching back to `dvc-demo-v1` then shows the effect:

```text
$ dvc status
data/dvc_demo.csv.dvc:
	changed outs:
		not in cache:       data/dvc_demo.csv

$ dvc pull
M       data/dvc_demo.csv
1 file fetched and 1 file modified
```

The data came back from the remote, which is exactly what the remote is for.

**Do not run `-c` on the shared container.** It deletes every object your workspace does not use,
including objects a classmate pushed.

`-A` (keep what every commit uses) works in the starter, but it fails in a project you started from
an empty folder if a commit was made before the remote was configured:

```text
ERROR: Failed to collect '<commit>': config file error: expected 'url' for dictionary value @
data['remote']['myazure']
```

That old commit's `.dvc/config` has no `myazure`, while your `config.local` adds a `sas_token` to
it, so DVC sees a remote without a URL. Use `-w` or `-T` instead.

## Checklist

- `git log` shows the dataset (with the remote configuration) and the two demo versions.
- `git tag` lists `dvc-demo-v1` and `dvc-demo-v2`.
- `.dvc/config` is committed and contains no token; `.dvc/config.local` is not tracked.
- The container holds `files/md5/42/171ec985af1d3aed38f4d6f497030b` (raw dataset),
  `files/md5/f7/b1510e29cd5937f597758753024eaf` and `files/md5/99/ad5820330fc57b44cd0cfb79f2eefa`
  (the two demo versions).
- `cat data/dvc_demo.csv` prints the version that matches the tag you checked out.

## Files you end up with

```text
mlflow-with-daghub/
  .dvc/config                  committed: remote myazure, account wut2026, no token
  .dvc/config.local            NOT committed: holds <SAS_TOKEN>
  .dvcignore
  data/.gitignore              committed: /raw_dataset.csv and /dvc_demo.csv
  data/raw_dataset.csv         ignored by Git, stored by DVC
  data/raw_dataset.csv.dvc     committed pointer
  data/dvc_demo.csv            ignored by Git, matches the checked-out tag
  data/dvc_demo.csv.dvc        committed pointer
  MLFlowSetup.ipynb            unchanged, used in the next assignment
```

Git tags: `dvc-demo-v1` and `dvc-demo-v2`.
