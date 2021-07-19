const chalk = require('chalk');
const degit = require('degit');
const ora = require('ora');
const sh = require('shelljs');
const util = require('util');

const _green = chalk.green;
const _red = chalk.red;
const shExec = util.promisify(sh.exec);

/**
 * Create a new SNAPP project with recommended dir structure, Prettier config,
 * testing lib, etc. Warns if already exists and does NOT overwrite.
 * @param {string} name  Desired dir name or path. Will recursively create
 *                       dirs without overwriting existing content, if needed.
 * @return {void}
 */
module.exports = function (name) {
  const emitter = degit('github:o1-labs/snapp-cli/templates/project#main', {
    cache: true, // enable to support offline use
    force: false, // throw err if dest is not empty
  });

  emitter.on('err', (err) => {
    console.error(err.message);
    console.error(_red('Error: ' + err.code));
  });

  const spinner = ora('Clone project template...').start();

  emitter
    .clone(name)
    .then(async () => {
      spinner.succeed(_green('Clone project template'));

      // Set dir for shell commands. Doesn't change user's dir in their CLI.
      sh.cd(name);

      // Git must be initialized before running `npm install` b/c Husky runs a
      // `prepare` NPM script to set up its pre-commit hook within `.git` during
      // installation. Otherwise Husky will throw an error.
      if (!sh.which('git')) {
        console.error(_red('Please ensure Git is installed, then try again.'));
        return;
      }

      await step('Initialize Git repo', 'git init -q && git branch -m main');

      // `/dev/null` is the only way to silence Husky's install log msg.
      await step('NPM install', 'npm ci --silent > "/dev/null" 2>&1');

      // `-n` (no verify) skips Husky's pre-commit hooks.
      await step(
        'Git init commit',
        `git add . && git commit -m 'Init commit' -q -n`
      );

      const str =
        `\nSuccess!\n` +
        `\nNext steps:` +
        `\n  cd ${name}` +
        `\n  git remote add origin <your-repo-url>` +
        `\n  git push -u origin main`;

      console.log(_green(str));
    })
    .catch((err) => {
      spinner.fail('Clone project template');

      if (err.code === 'DEST_NOT_EMPTY') {
        console.error(
          _red('Destination directory is not empty. Not proceeding.')
        );
      } else {
        console.error(err.message);
        console.error(_red('Error: ' + err.code));
      }
    });
};

async function step(step, cmd) {
  const spin = ora(`${step}...`).start();
  try {
    await shExec(cmd);
    spin.succeed(_green(step));
  } catch (err) {
    spin.fail(step);
  }
}
