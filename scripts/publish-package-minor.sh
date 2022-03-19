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
npm version minor --force

cd $BASEDIR/../
npx nx build $PACKAGE

cd $BASEDIR/../dist/packages/$PACKAGE
npm publish --access=public

cd $PWDDIR
