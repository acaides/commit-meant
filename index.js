#! /usr/bin/env node

/* globals require, process */

'use strict';

const log = {},
    _ = require('lodash'),
    exec = require('child_process').exec,
    program = require('commander'),
    NO_COMMIT_MEANT = 'No commit-meant found.',
    messageRe = /^(MAJOR|MINOR|PATCH) - ([A-Z].+)\n\n((?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?)\n\n((?:[^\*+-].+(?:\n\n)*)*)((?:[\*]\s.+\n*)*)/g,
    noteRe = /[\*+-]\s/g,
    LOG_SEPARATOR = 'GJVX47gWz4@7m&*uYX%5qe24';

function message2cm(msg) {
    let json = msg
        .replace(/"/gi, '\\"')
        .replace(messageRe, '{ "changeType": "$1", "title": "$2", "issue": "$3", "description": "$4", "notes": "$5" }')
        .replace(/\n/g, ''),
        cm;

    try {
        cm = JSON.parse(json);
        cm.changeType = cm.changeType.toLowerCase();
        cm.notes = _.filter(_.map(cm.notes.trim().split(noteRe), note => note.trim()), note => note);

        return cm;
    } catch (e) {
        return null;
    }
}

program
    .version('0.1.0')
    .usage('[options] [source]')
    .description('Reads GIT history and determines the meaning of merging the specified source commit, or HEAD by default, into the destination branch (origin/master by default).')
    .option('-d, --destination <destination>', 'the destination branch for merges, "origin/master" by default')
    .option('-s, --silent', 'skips outputting to the console')
    .option('-f, --field <name>', 'output only the value of the commit-meant field with the specified name')
    .option('-l, --log', 'if a commit-meant is not found, output a message with debug information')
    .parse(process.argv);

function output(cm, dontExit) {
    if (!program.silent) {
        if (!cm) {
            if (program.log) {
                console.log(log);
            }
            console.log(NO_COMMIT_MEANT);
        } else if (program.field) {
            console.log(cm[program.field]);
        } else {
            console.log(cm);
        }
    }

    if (!dontExit) {
        process.exit(cm ? 0 : 1);
    }
}

let destination = program.destination || 'origin/master',
    source = program.args.length === 0 ? 'HEAD' : program.args[0],
    logCommand = `git log ${destination}..${source} --no-merges --pretty=format:'${LOG_SEPARATOR}%s%n%n%b'`;

log.logCommand = logCommand;

exec(logCommand, (error, stdout, stderr) => {
    if (error || stderr.toString().length > 0) {
        output(null);
        return;
    }

    if (stdout.length === 0) {
        // SOURCE === DESTINATION case: look at the destination tip for cm
        let tipLogCommand = `git log ${destination} -1 --no-merges --pretty=format:'%s%n%n%b'`;

        log.tipLogCommand = tipLogCommand;

        exec(tipLogCommand, (error, stdout) => {
            if (error || stderr.toString().length > 0) {
                output(null);
                return;
            }

            let tipLogOutput = stdout.toString(),
                cm = message2cm(tipLogOutput);

            output(cm);
        });
    } else {
        let logOutput = stdout.toString(),
            cms = _.map(_.drop(logOutput.split(LOG_SEPARATOR)), message2cm);

        log.logOutput = logOutput;
        log.cms = cms;

        output(_.find(cms, cm => cm));
    }
});
