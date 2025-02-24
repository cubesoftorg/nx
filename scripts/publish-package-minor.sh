#!/bin/sh

set -e

BASEDIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PWDDIR="$(pwd)"

if [ -z "$1" ]
then
    echo "No package specified"
    exit 1
else
    PACKAGE=$1
fi

cd $BASEDIR/../packages/$PACKAGE
pnpm version minor --force

cd $BASEDIR/../
pnpm exec nx build $PACKAGE

cd $BASEDIR/../dist/packages/$PACKAGE
pnpm publish --access=public --no-git-checks

cd $PWDDIR
