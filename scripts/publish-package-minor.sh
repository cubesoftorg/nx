#!/bin/sh

set -e

BASEDIR=$(dirname "$0")
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
nx build $PACKAGE

cd $BASEDIR/../dist/packages/$PACKAGE
npm version minor --force && npm publish --access=public

cd $PWDDIR
