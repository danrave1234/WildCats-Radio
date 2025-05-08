::: header
# Shoutcast DNAS Server 2.6 {#shoutcast-dnas-server-2.6 align="center"}

(Last Updated 08 Sep 2018)
:::

\
Thank you for choosing Shoutcast (powered by Radionomy)! Now that you
have downloaded the Shoutcast DNAS (Distributed Network Audio Server),
you will find all associated documentation, some configuration examples
and related files to aid with getting the Shoutcast DNAS server up and
running. You can check what changes and fixes have been made with this
release by looking through the provided
**[changelog](DNAS_Server_Changelog.html)**.

The documentation and related files provided with the DNAS server are
the correct for the version of the DNAS server version installed. You
can also find online copies of the documentation [**via the
wiki**](http://wiki.shoutcast.com/wiki/SHOUTcast_Broadcaster){target="_blank"}
however these may not relate to the DNAS server version installed. If in
doubt use the local documentation provided with the DNAS server being
used.

\

## Core

------------------------------------------------------------------------

**sc_serv\[.exe\]** - The Shoutcast DNAS server program file (*this is
required*)

**setup\[.bat/.sh\]** - Command used to run the DNAS server in \'Setup
Mode\' which allows for quick setup of the DNAS server (*recommended if
you need a simple setup or are new to setting up a DNAS server*)

\

## Documentation

------------------------------------------------------------------------

These are all of the supporting documents provided with the DNAS server;
from how to get it setup to what the JSON response for bandwidth usage
should look like (and everything in-between).\
\

**[Getting Started](docs/Getting_Started.html)** - Guide for setting up
and configuring the DNAS server for use

**[DNAS Server](docs/DNAS_Server.html)** - Core documentation for the
DNAS server\'s options and features; from how to run it, to the public
and private API methods it provides

**[Authhash Management](docs/DNAS_Server_Authhash_Management.html)** -
How to manage authhashes inside the DNAS server

**[Source Support](docs/DNAS_Server_Source_Support.html)** - How to
connect sources to the DNAS server

**[JSON Responses](docs/DNAS_Server_JSON_Responses.html)** -
Documentation showing the JSON responses available

**[XML Responses](docs/DNAS_Server_XML_Responses.html)** - Documentation
showing the XML responses available

\
Additional information can be found on the [**Shoutcast
wiki**](http://wiki.shoutcast.com) for broadcasting and developer
aspects of the DNAS server as well as other parts of the Shoutcast
platform from the Shoutcast API to Shoutcast client implementation
requirements.

\

## Examples

------------------------------------------------------------------------

\

    It is recommended to use the 'Setup Mode' actions for most new setup needs.

These examples are provided as a means to see what a working
configuration file looks like under some of the common use cases for a
DNAS server.\
\

To use these examples, you will need to copy the required files (check
the dependencies noted) into the folder where sc_serv\[.exe\] is and
after reading and editing them as needed, then start the DNAS start with
the one required (which may be easier if you rename the intended file as
sc_serv.conf so the DNAS will automatically load it).

+-----------------------------------+-----------------------------------+
| **examples/sc_serv_simple.conf**  | Simple configuration file for     |
|                                   | running a basic DNAS server. This |
|                                   | has no dependencies on the other  |
|                                   | examples.\                        |
|                                   | \                                 |
+-----------------------------------+-----------------------------------+
| **examples/sc_serv_basic.conf**   | This is used by the               |
|                                   | sc_serv_public.conf and           |
|                                   | sc_serv_relay.conf to show how    |
|                                   | core settings can be shared       |
|                                   | between configurations.\          |
|                                   | \                                 |
+-----------------------------------+-----------------------------------+
| **examples/sc_serv_public.conf**  | This has a dependency upon        |
|                                   | sc_serv_basic.conf.\              |
|                                   | \                                 |
+-----------------------------------+-----------------------------------+
| **examples/sc_serv_relay.conf**   | This has a dependency upon        |
|                                   | sc_serv_basic.conf.\              |
|                                   | \                                 |
+-----------------------------------+-----------------------------------+
| ``` {align="left"}                |                                   |
| The debugging options can no      |                                   |
| w be changed via the server admin |                                   |
| page for when you may not have    |                                   |
| access to the configuration file. |                                   |
| ```                               |                                   |
+-----------------------------------+-----------------------------------+

\

## Miscellaneous

------------------------------------------------------------------------

These are supporting files mainly relating to the setup options and the
configuration examples. If in doubt then do not alter any of the files
as this may break other features (especially if altering the \'setup\'
folder.\
\

**setup folder** - This contains files needed for the DNAS server\'s
\'Setup Mode\'. **Do not modify or run this separately as it will not
work unless run within the DNAS server.** To run the \'Setup Mode\', run
**setup\[.bat/.sh\]**

**control folder** - Used with the configuration examples to hold the
sc_serv.ban and sc_serv.rip files generated by the DNAS server when it
is running

**logs folder** - Used with the configuration examples to hold the DNAS
server log files

**cacert.pem** - Required to ensure HTTPS support works correctly where
it is used. Newer versions of the file can be obtained from
[**http://curl.haxx.se/ca/cacert.pem**](http://curl.haxx.se/ca/cacert.pem)
as required.

    Do not remove the cacert.pem file from its
    location unless you are instructed to do so!

**tos.txt** - Shoutcast Terms of Service (TOS) details \[non-Windows
only - note: for Windows users this is in the installer\]

**uninstall_shoutcast-dnas-v2.exe** - Uninstaller for the DNAS server
\[Windows only\]
