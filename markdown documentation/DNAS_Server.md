::: header
# Shoutcast DNAS Server 2.6 {#shoutcast-dnas-server-2.6 align="center"}

(Last Updated 8 Sep 2018)
:::

+-----------------------------------------------------------------------+
| ::: {#toctitle}                                                       |
| **Contents** [\[[hide](javascript:toggleToc()){#togglelink            |
| .internal}\]]{.toctoggle}                                             |
| :::                                                                   |
|                                                                       |
| - [1 Introduction](#Introduction)                                     |
| - [2 Overview](#Overview)                                             |
| - [3 Getting Started](#Getting_Started)                               |
|   - [3.1 Running the Server](#Running_the_Server)                     |
|   - [3.2 Windows](#Windows)                                           |
|     - [3.2.1 Install as a Service](#Install_as_a_Service)             |
|     - [3.2.2 Uninstall the Service](#Uninstall_the_Service)           |
|     - [3.2.3 Run in the Console](#Run_in_the_Console)                 |
|   - [3.3 Linux / BSD / Raspbian / Mac OS X](#Linux_/_Mac_OS_X_/_BSD)  |
|     - [3.3.1 Run as a Daemon](#Run_as_a_Daemon)                       |
|     - [3.3.2 End a Daemon](#End_a_Daemon)                             |
|     - [3.3.3 Run as a Non-Daemon](#Run_as_a_Non-Daemon)               |
|     - [3.3.4 Immediate Segfault on Run](#Immediate_Segfault_on_Run)   |
|   - [3.4 Run in Setup Mode](#Run_in_Setup_Mode)                       |
|   - [3.5 Additional Signals](#Additional_Signals)                     |
| - [4 Configuration File](#Configuration_File)                         |
|   - [4.1 Banning](#Banning)                                           |
|   - [4.2 Listener Behaviour](#Listener_Behaviour)                     |
|   - [4.3 Debugging](#Debugging)                                       |
|   - [4.4 Flash Policy Server](#Flash_Policy_Server)                   |
|   - [4.5 Introduction and Backup                                      |
|     Files](#Introduction_and_Backup_Files)                            |
|   - [4.6 Logging](#Logging)                                           |
|   - [4.7 Miscellaneous](#Miscellaneous)                               |
|   - [4.8 Networking](#Networking)                                     |
|   - [4.9 Network Buffers](#Network_Buffers)                           |
|   - [4.10 Relaying](#Relaying)                                        |
|   - [4.11 Reserved List](#Reserved_List)                              |
|   - [4.12 Stream Configuration](#Stream_Configuration)                |
|   - [4.13 Premium Unlock (v2.6)](#Premium)                            |
|   - [4.14 Web Connection (W3C)                                        |
|     Logging](#Web_Connection_(W3C)_Logging)                           |
|   - [4.15 YP Server Behaviour](#YP_Server_Behaviour)                  |
|   - [4.16 YP Server Errors](#YP_Server_Errors)                        |
|   - [4.17 Statistics](#Statistics)                                    |
|   - [4.18 Blocked User Agents](#UserAgents)                           |
|   - [4.19 Artwork (Experimental)](#Artwork)                           |
| - [5 Administration](#Administration)                                 |
|   - [5.1 Administration Pages](#Administration_Pages)                 |
|     - [5.1.1 Public Pages](#Public_Pages)                             |
|     - [5.1.2 Private Pages](#Private_Pages)                           |
|       - [5.1.2.1 Configuration Reload](#Config_Reload)                |
|   - [5.2 XML / JSON / JSON-P                                          |
|     Responses](#XML_/_JSON_/_JSON-P_Responses)                        |
| - [6 Stream Addresses](#Stream_Addresses)                             |
|   - [6.1 HTTP Protocol Compatibility](#HTTP_Protocol_Compatibility)   |
| - [7 Maximum Listener Connection                                      |
|   Limits](#Maximum_Listener_Connection_Limits)                        |
| - [8 Example Configurations](#Example_Configurations)                 |
|   - [8.1 sc_serv_basic](#sc_serv_basic)                               |
|   - [8.2 sc_serv_public](#sc_serv_public)                             |
|   - [8.3 sc_serv_relay](#sc_serv_relay)                               |
|   - [8.4 sc_serv_simple](#sc_serv_simple)                             |
+-----------------------------------------------------------------------+

[]{#Introduction}

## 1. Introduction

------------------------------------------------------------------------

The purpose of this document is to show you the different configuration
options supported by the DNAS server (sc_serv) along with basic and more
advanced example configurations to get started with using the DNAS
server and the many features it can offer.

\
The aim of the DNAS server is to provide enhanced serving features and
also access to the new YP2 infrastructure whilst maintaining as much
backward compatibility with previous versions of DNAS server as
possible. The new features introduced include:

- Serving multiple streams from a single server instance
- Relaying multiple streams from a single server instance
- Multiplexing all server activity through a single IP port
- Shoutcast 2 wire protocol support for sources, relays and listener
  clients
- Repackaging of Shoutcast 1.x and Shoutcast 2.x stream data as needed
  for listener clients
- Ability to use any Shoutcast compatible source (1.x or 2.x) for any
  stream
- v2 Shoutcast Directory (YP2) infrastructure support
- Real-time metadata and statistic reporting
- Static station id support
- Expanded in-stream metadata support including sending of artwork
- UTF-8 and international character encoding
- Improved server and stream security
- Improved server support for using DNS addresses instead of raw IP
- Backup url support to keep streams active when the main source fails
- Improved support for intro and backup files over the 1.x support

\

[]{#Overview}

## 2. Overview [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

To take full advantage of the features provided by the 2.x DNAS server,
it is recommended to use a 2.x compatible source which can provide the
required data.\
\
However this does not prevent you from using a 1.x compatible source
with the 2.x DNAS, though you will not get the full benefit of all of
the additional platform and DNAS features with the 2.x DNAS server.

With the introduction of the **v2.4.7** DNAS server, you are now also
able to connect a 1.x source for any configured stream as long as you
enter the correct password for the stream. See [Server Source
Support](DNAS_Server_Source_Support.html) for more information about
this and the history of this support.

    If a listener connection is deteected as 'Shoutcast compatible',
    the DNAS will repackage the stream and any metadata into the
    2.x or 1.x Shoutcast streaming format as applicable.

\

[]{#Getting_Started}

## 3. Getting Started [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

A key aspects of the v2 Shoutcast Directory infrastructure (as used by
the 2.x DNAS server) is an authhash which is used to validate your DNAS
server when it connects to the Shoutcast Directory for any of the
station(s) you run. Once an authhash has been obtained for a stream then
it will be valid for all DNAS servers of the station being broadcast
which make use of it.

\

    Important: An authhash is not something you are charged for and are free to be created.

\
Details on how to create and manage authhash(s) for your streams as well
as additional information can be found
[**here**](DNAS_Server_Authhash_Management.html) via the \'**Server
Summary**\' page as long as a valid source has been connected to the
server. This will automatically update the configuration file(s) with
the new authhash and if the stream is set to be public then will attempt
to get the stream listed in the Shoutcast Radio Directory.

\

[]{#Running_the_Server}

## 3.1. Running the Server [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: serv
[![Example of the Windows DNAS server
running](res/Example_Windows_Console.png){.serv}](res/Example_Windows_Console.png "Example of the Windows DNAS server running")
:::

The DNAS server is able to be run either as a console application or it
can be run as service (Windows) or daemon (Linux / BSD / Raspbian / Mac
OS X). The following sections below detail how to get the DNAS server
running on the different operating systems supported by it.

\

[]{#Windows}

## 3.2. Windows [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The Windows version of the DNAS server is designed to run on fully
updated and patched versions of Windows 2000 and up, including server
versions.

\

[]{#Install_as_a_Service}

## 3.2.1. Install as a Service [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

sc_serv.exe install \[servicename\] \[username\] \[password\] \[conf\]

::: serv
[![Example Error Registering as a
Service](res/Windows_Service_Install_Failure.png){.serv}](res/Windows_Service_Install_Failure.png "Example Error Registering as a Service")
:::

**servicename** - Unique name for the service install \[optional\]

    If 'servicename' is not specified, then it
    will be set as 'Shoutcast DNAS Service'

If you set this, then you need to remember it if you later use the
\'uninstall\' action. If \'servicename\' is already used by an existing
registered service then this will fail (as per the screenshot to the
right).

**username** - User under which to run the service as or \'0\' for the
local system \[optional\]

**password** - Password for user or \'0\' for the local system or with
no password \[optional\]

**conf** - File path to the configuration file either as a full or
relative path \[optional\]

    If no file / an invalid file is specified then DNAS server will abort loading
    once it has looked for sc_serv.ini or sc_serv.conf in the same folder as
    sc_serv.exe (using sc_serv.ini first and then sc_serv.conf as applicable).

\
To run the DNAS server with a configuration file in the same folder as
the server as the current local system user you would enter into the
console:

**sc_serv.exe install sc_serv**\
or\
**sc_serv.exe install sc_serv 0 0 sc_serv.conf**

\

[]{#Uninstall_the_Service}

## 3.2.2. Uninstall the Service [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

sc_serv.exe uninstall \[servicename\]

**servicename** - Name used to install the service \[optional\]

    If 'servicename' is not specified, then it
    will be set as 'Shoutcast DNAS Service'

If you set this during \'install\', then you need to use the same name
entered otherwise the action will fail.

\
To uninstall the DNAS server assuming it was installed as detailed in
the [install section](#Install_as_a_Service) then you would enter into
the console:

**sc_serv.exe uninstall**\
or\
**sc_serv.exe uninstall sc_serv**

\

[]{#Run_in_the_Console}

## 3.2.3. Run in the Console [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: serv
[![Prompt for Configuration
File](res/Windows_Console.png){.serv}](res/Windows_Console.png "Prompt for Configuration File")
:::

sc_serv.exe \[conf\]

**conf** - File path to the configuration file (can be relative or
absolute) \[optional\]

    If no file / an invalid file is specified then the DNAS server will abort loading
    once it has looked for sc_serv.ini or sc_serv.conf in the same folder as
    sc_serv.exe (using sc_serv.ini first and then sc_serv.conf as applicable). If a
    default configuration file (sc_serv.conf or sc_serv.ini) is not found then you
    will be shown a prompt for the configuration file to choose from.

\

[]{#Linux_/_Mac_OS_X_/_BSD}

## 3.3. Linux / BSD / Raspbian / Mac OS X [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: serv
[![Example of the Linux DNAS Server
Running](res/Example_Linux_Console.png){.serv}](res/Example_Linux_Console.png "Example of the Linux DNAS Server Running")
:::

Remember to enable the required access on the sc_serv file by doing
\'**chmod a+x sc_serv**\' after extracting it from the distribution file
otherwise the OS is likely to not run it and will instead show the error
message \'**./sc_serv: Permission denied**\'.

\

[]{#Run_as_a_Daemon}

## 3.3.1. Run as a Daemon [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

./sc_serv daemon \[conf\]

**conf** - File path to the configuration file \[optional\]

    If no file / an invalid file is specified then DNAS server will abort loading
    once it has looked for sc_serv.ini or sc_serv.conf in the same folder as
    sc_serv (using sc_serv.ini first and then sc_serv.conf as applicable).

\
e.g.

**./sc_serv daemon**\
or\
**./sc_serv daemon ./sc_serv.conf**

::: serv
[![Example of the Linux DNAS Server Started as a
Daemon](res/Linux_Daemon_Mode.png){.serv}](res/Linux_Daemon_Mode.png "Example of the Linux DNAS Server Started as a Daemon")
:::

\
When run this should output the following:

\'sc_serv going daemon with PID \[XXXX\]\' where XXXX is the \<pid\> of
the process.

\

[]{#End_a_Daemon}

## 3.3.2. End a Daemon [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

kill -SIGTERM \<pid\>\
or\
kill -15 \<pid\>\
or\
kill -s TERM \<pid\>

**\<pid\>** - The PID of the daemon instance (reported when the daemon
started or can be found with \'**ps ax \| grep sc_serv**\' as long as
sc_serv was the file run otherwise you can just use \'ps ax\' if the
filename isn\'t known). Additionally the PID of the DNAS server is
listed in the log file or shown in the console when run as a daemon.

\

[]{#Run_as_a_Non-Daemon}

## 3.3.3. Run as a Non-Daemon [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: serv
[![Prompt for Configuration
File](res/Linux_Console.png){.serv}](res/Linux_Console.png "Prompt for Configuration File")
:::

./sc_serv \[conf\]

**conf** - File path to the configuration file (can be relative or
absolute) \[optional\]

    If no file / an invalid file is specified then the DNAS server will abort loading
    once it has looked for sc_serv.ini or sc_serv.conf in the same folder as
    sc_serv (using sc_serv.ini first and then sc_serv.conf as applicable). If a
    default configuration file (sc_serv.conf or sc_serv.ini) is not found then you
    will be shown a prompt for the configuration file to choose from.

\

[]{#Immediate_Segfault_on_Run}

## 3.3.4. Immediate Segfault on Run [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Some users may find the DNAS server will segfault as soon as you try to
start it e.g. via **./sc_serv** . The most likely cause of this issue is
from a faulty installation of the DNAS server e.g. being treated as a
text file instead of as a binary file via an FTP transfer. The following
steps can help to determine if this is the cause of the segfault on
startup.

**1.** Ensure the run permissions have been correctly set by running
\'**chmod a+x sc_serv**\'\
\
**2.** Run \'**ldd sc_serv**\' - if there is an issue then you will
likely see the output as **statically linked** instead of a normal list
of libraries\
\
**3.** Run \'**readelf -a sc_serv**\' - if the file is corrupted then
you will see a number of error messages instad of a long list of data
(like the example below)

    readelf: Error: Unable to read in 0x500 bytes of section headers
    readelf: Error: Section headers are not available!
    Aborted

\
If either of the commands above return an error then you should attempt
to re-download the DNAS server and compare the size of sc_serv reported
in the install archive to what is then extracted / downloaded on the
host to ensure it matches.

If the issue persists, make sure you have installed the correct version
for the platform architecture being used and that if needed any
compatibility layers have been installed to allow the DNAS server to
load e.g. Linux compatibility options on BSD platforms.

\

[]{#Run_in_Setup_Mode}

## 3.4. Run in Setup Mode [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: serv
[![Setup Mode
Running](res/Console_Setup_Mode.png){.serv}](res/Console_Setup_Mode.png "Setup Mode Running")
:::

To make it easier to setup the DNAS server for broadcasting, a setup
mode is provided which is specifically for setting up common options
needed for the DNAS to run.

This mode is run by choosing **setup.bat** (Windows) or **./setup.sh**
(non-Window) found in the same folder as sc_serv\[.exe\].

::: serv
[![Setup Mode Error
Loading](res/Setup_Mode_Error.png){.serv}](res/Setup_Mode_Error.png "Setup Mode Error Loading")
:::

\

    For setup mode to work, you need to have the 'setup' folder present
    in the folder where sc_serv[.exe] was installed into it. If this is not
    the case then you will see an error message like the one to the right.

\

[]{#Additional_Signals}

## 3.5. Additional Signals [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

When run on Linux / BSD / Raspbian / Mac OS X then some additional
signals are supported to allow for additional control over the running
daemon instance of the DNAS server.

The following signals can be used with the \'kill\' command (in the
manner of your choosing for using the kill command) along with the
\<pid\> of the daemon instance to do one of the following actions:

  -------------- -----------------------------------------------------------------------------
  **SIGKILL**    Stops the DNAS server (also SIGTERM, SIGINT and SIGQUIT will work)
  **SIGHUP**     Rotates logfile, w3clog and streamw3clog
  **SIGWINCH**   Reload the \'reserved\', \'banned\' and \'blocked user agent\' list file(s)
  **SIGUSR1**    Reload server configuration file
  **SIGUSR2**    Reload server configuration file (forced)
  -------------- -----------------------------------------------------------------------------

\
The result of SIGHUP is that the current log file contents will be moved
into \<logfile\>\_1 e.g. **sc_serv_1.log**, \<logfile\>\_1 will be moved
into \<logfile\>\_2 e.g. **sc_serv_2.log** and so on for all log files
which can be found which match the current log file\'s name. This is
useful if timed to have it create day specific log files. When
\<logfile\>\_5 is reached, the current one will be placed into a GZIP
encoded archive named in the format of
**\<logfile\>\_log\_\<date\>\_\<time\>\_w3c.gz** where date and time are
when the archive is created.

\

    These signals are not supported by the Windows version of DNAS server which will
    only respond to the Ctrl+C / Ctrl+Break / console close commands the OS provides.

\

[]{#Configuration_File}

## 4. Configuration File [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Here you can find a complete list of all of the configuration options
which are provided by DNAS server which ranges from logging to
networking configuration and control over the media being used when
streaming via the server.

    The configuration files are text files and can be edited in any text editor.

\
Configuration entries labelled as **\<MULTI\>** can be used to set up
simultaneous connections to the server or allow for multiple connections
from various sources. These are specified by adding **\_#** to the end
of the option\'s name as shown below where **\#** begins with one. If
you are only working with a single instance then you do not need to add
the **\_#** part as any instances of a configuration option will assume
it is for **\_1**.

\

    The <MULTI> system is not hierarchical and all values
    beyond the default must be specified for all connections.

\
For example, if you wanted stream specific listener limits on 2 streams
you must do:

maxuser=128\
streammaxuser_1=32\
streammaxuser_2=32

Note that you CANNOT do it like this as it leads to stream 2 following
maxuser:

maxuser=128\
streammaxuser=32

\
The configuration files also allow for notes or options to be disabled
by the use of a comma (**;**) at the start of a line which can be seen
in all of the configuration examples. Known options in the configuration
files are recognised irrespective of the case they are entered in the
configuration file so **maxuser** and **MaXuSer** will be handled the
same way.

\
Any items found in the configuration file which are not known (as
detailed in following sections) or is not processed as a comment will be
reported in the following manner:

::: thumb
[![Invalid Configuration
Item](res/Invalid_Configuration_Item.png){.thumb}](res/Invalid_Configuration_Item.png "Invalid Configuration Item")
:::

**\<date + time\>    WARN    \[CONFIG\] Invalid item on line XX of
\<conf\> -\> \`\<option\>\'**\
\
*\<date + time\>* is the date and time the event happens\
*XX* is the line in the file \<conf\> with the error is\
*\<option\>* is the name of the invalid item found

\
A properly configured DNAS server should not report any configuration
warnings and most warnings are going to be from typos or options which
have been deprecated / renamed (which if so then should be resolved
using the suggested name configuration option shown in the message).

\

[]{#Banning}

## 4.1. Banning [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**banfile** : File to store the list of banned addresses *\[Default =
sc_serv.ban\]*

**savebanlistonexit** : Write any changes to the \'banfile\' when
required *\[Default = 1\]*

    If you are using a folder for saving the file into then you need to ensure that the
    folder already exists as the DNAS server will not attempt to the create the folder.

\

[]{#Listener_Behaviour}

## 4.2. Listener Behaviour [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**maxuser** : Specify the maximum number of listeners allowed to connect
to the server *\[Default = 512\]*

    This is used in conjunction with 'streammaxuser' (see section 4.12) to control the
    limit on the number of listener allowed to connect to the server.

**listenertime** : Specify the maximum time in minutes a listener can
listen to the stream *\[Default = 0\]*

    A value of zero means there will be no time limit.

**autodumpusers** : Enable to allow the server to disconnect listeners
if the source disconnects *\[Default = 0\]*

\
**srcip** : Specify the server side binding address for sources to
connect on *\[Default = \<no value\>\]*

**destip** : Specify the server side binding address for listeners
*\[Default = \<no value\>\]*

[Notes:]{.underline}

If \'**any**\' or no value is specified then DNAS server listens to all
addresses.\
\
If you specify a value for \'**destip**\' then this will be used by the
listen feature on the Administration Pages (see [section
5.1](#Administration_Pages)) so it can provide a valid stream url in the
generated playlist. If \'**destip**\' is not specified then the server
will attempt to auto-generate the address required for the listener to
use for connecting.\
\
The address provided needs to be in a valid format like http:// or as an
address which can be resolved to a valid IP address otherwise the
internal lookups done will fail (depends upon the server configuration
and OS being used).\
\
The server may stop if the specified address cannot be resolved or
correctly bound to i.e. due to another instance is already running.\
\

**publicip** : Specify the public address for listeners to connect to
when publically listed *\[Default = \<no value\>\]*

[Notes:]{.underline}

This is treated in the same way as \'**destip**\' (as detailed above)
but is only used when the stream is set to be publically listed and will
not be used for being bound to or for private streams.\
\
This will be used preferentially to the \'**destip**\' value (if it is
specified).\
\
The purpose of this configuration option is for when you need to use
\'**destip**\' and the address is not valid publically e.g. a localhost
/ loopback address, then this will still allow you to specify a DNS / IP
address to be used with the public YP listing whilst still being able to
bind the DNAS to the correct address.\
\
If \'**destip**\' is not specified and \'**publicip**\' is specified,
then this will still be used for the public YP listing and will have no
effect on any binding the DNAS might attempt to do (as \'**destip**\' is
used for).

\
**titleformat** : Specify a string to be used in-place of the default
icy-name string being used *\[Default = \<no value\>\]*

**urlformat** : Specify a string to be used in-place of the default
icy-url string being used *\[Default = \<no value\>\]*

\

[]{#Debugging}

## 4.3. Debugging [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    The debugging options can now be changed via the server admin
    page for when you may not have access to the configuration file.

\
The default behaviour is for no debug logging for the options listed
below:

**yp2debug** : Enable debug logging of YP2 connections

**shoutcastsourcedebug** : Enable debug logging of Shoutcast source
connections

**uvox2sourcedebug** : Enable debug logging of Shoutcast 2 source
connections

**shoutcast1clientdebug** : Enable debug logging of Shoutcast 1.x
listener clients

**shoutcast2clientdebug** : Enable debug logging of Shoutcast 2 listener
clients

**relayshoutcastdebug** : Enable debug logging for Shoutcast relays

**relayuvoxdebug** : Enable debug logging for Shoutcast 2 relays

**relaydebug** : Enable debug logging of common relay code

**streamdatadebug** : Enable debug logging of common streaming code

**httpstyledebug** : Enable debug logging of http style requests

**statsdebug** : Enable debug logging of statistics

**microserverdebug** : Enable debug logging of common server activity

**threadrunnerdebug** : Enable debug logging of the thread manager

**flashpolicyserverdebug** : Enable debug logging for the flash policy
server

**webclientdebug** : Enable debug logging of web client connections

**admetricsdebug** : Enable debug logging of advert / metrics activity

\

[]{#Flash_Policy_Server}

## 4.4. Flash Policy Server [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

These options allow for control over the Flash Policy Server requests
which can be made to the server which improves the interoperability of
the server with Flash players.

**flashpolicyfile** : Name of file containing flash crossdomain policies
for the server if the defaults are not appropriate *\[Default =
crossdomain.xml\]*

[Notes:]{.underline}

The default behaviour is to return a reponse indicating that access to
the server from any domain to only configured ports is allowed (which
varies dependig on how \'portbase\', \'portlegacy\' and
\'alternateports\' have been setup):

``` src
<?xml version="1.0"?>
  <!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">
    <cross-domain-policy>
      <allow-access-from domain="*" to-ports="portbase,portbase+1"/>
      <!-- or -->
      <allow-access-from domain="*" to-ports="portbase,portlegacy"/>
      <!-- or -->
      <allow-access-from domain="*" to-ports="portbase"/>
    </cross-domain-policy>
```

**flashpolicyserverport** : Enable to allow handling of flash policy
server requests made on the specified port to return \'flashpolicyfile\'
*\[Default = 0\]*

    Flash policy server requests are usually attempted first on port
    843 before trying the server port (as specified by 'portbase').
    If that does not work then an attempt will be made to connect
    directly to /crossdomain.xml to determine the access allowed.

\

[]{#Introduction_and_Backup_Files}

## 4.5. Introduction and Backup Files [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

[Important Notes:]{.underline}

The intro and backup files need to be in the same format (MP3 / AAC),
bitrate and sample rate as the stream(s) being provided. Not doing this
will lead to the stream afterwards playing at the wrong speed or it not
playing at all. Where possible, the DNAS will attempt to ensure this and
will skip using any files which do not match the stream.\
\
The files will also have any ID3v1.x, ID3v2.x, Lyrics3 and Apev2 tags
removed from the file to attempt to improve listener compatibility.

\
**introfile** : File to play when a listener first connects to the
server when a source is already connected *\[Default = \<no value\>\]*

**backupfile** : File to play if the source disconnects from the server
when a listener is still connected or when there is no source connected
*\[Default = \<no value\>\]*

Specifying a valid backupfile makes it possible to always provide a
listener connection with a stream and improves the ability to cope with
dropped source connections to the DNAS server without loosing listeners
already connected to the stream at the time.

    When a backupfile is played and a source (re)connects to the stream,
    the listener will be tranisitioned to the stream provided by the source.

**backuptitle** : The title to provide if the stream source is not
connected when a listener connects to the stream only if a backup file
has been correctly configured *\[Default = \<no value\>\]*

    If this is not specified then a cleaned version of
    the backup filename will be used as the title.

**backuploop** : The number of times to play the configured backup file
to a listener when there is no source connected *\[Default = 0\]*

    The default value will keep repeating the backupfile until a
    source for the stream is provided or the listener disconnects.

**maxspecialfilesize** : Change the maximum size in bytes of the backup
and intro files *\[Default = 30000000\]*

\

[]{#Logging}

## 4.6. Logging [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**log** : Enable logging of the servers output *\[Default = 1\]*

**screenlog** : Enable logging of servers output to the console
*\[Default = 1\]*

    If log=0 or when running this as a daemon / service
    then this option will be ignored as it is not applicable.


    The output is colored to make it easier to see issues
    in the output. Errors are red, warnings yellow / orange,
    debugging green and updates blue.

\
**logfile** : Specify a different logfile to save the logs into
*\[Default = %temp%\\sc_serv.log or /tmp/sc_serv.log\]*

    If the log file cannot be created (which will attempt to create the default file
    if the specified file cannot be created), either %temp%\sc_serv_<pid>.log or
    /tmp/sc_serv_<pid>.log will be attempted to be created (where <pid> is the
    process id of the running DNAS instance.

    This is mainly for non-Windows versions where permission conflicts
    can prevent the DNAS from starting. Though this can affect Windows
    services if a specific log file has not been configured for each instance.

**logrotates** : Specify the number of backups made when the log is
rotated *\[Default = 5\]*

**logarchive** : Enable storing of rotated log files which would
otherwise be deleted once the number of rotates has been reached into a
GZIP encoded archive *\[Default = 0\]*

**logclients** : Enable logging of details about listener connections
and disconnections made *\[Default = 1\]*

    If you are using a folder for saving the logs into then you need to ensure the
    folder already exists as the DNAS server will not create the folder for you.

**rotateinterval** : Specify the number of seconds (the default is set
at 24 hours) between the last automatic log rotatation and the next
automatic rotation *\[Default = 86400\]*

    If you want to completely disable automatic log rotation then set this value to 0.
    This does not prevent you from doing manual log rotations via the admin options.

\

[]{#Miscellaneous}

## 4.7. Miscellaneous [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**configrewrite** : Re-write the \'config file\' on server exit
*\[Default = 0\]*

This can accept the following values:

\
**0**  →  do not re-write the configuration file\
**1**  →  only save options which are different from the default value\
**2**  →  full save even if the value is the same as the default value
(this used to the behaviour when set to 1)

\
**cpucount** : Specify the number of cpu\'s present instead of the
calculated number if non-zero *\[Default = 0\]*

\
**unique** : Specify a substitution string for the \'**\$**\' character
to be used when processing filenames which if specified will set any
occurences of \'**\$**\' to the value set. This will be used in the
processing of the following filenames:

logfile, introfile, streamintrofile, backupfile, streambackupfile,
banfile, streambanfile, ripfile, streamripfile, agentfile,
streamagentfile, include, w3clog, streamw3clog, portbase, artworkfile,
streamartworkfile

So when \'unique\' is changed from \'\$\' to say \'test\' then the
following happens if \'logfile\' is set to
\'/usr/local/shoutcast/\$.log\' then this would be converted to
\'/usr/local/shoutcast/test.log\'

\
**include** : Specify an additional include file containing settings to
be processed from the current point in the main configuration file
*\[Default = \<no value\>\]*

[Notes:]{.underline}

You can do multiple calls of this allowing for a basic configuration
file with then \'specific\' stream configurations set in individual conf
files though you need to ensure not to include a reference to the same
file in itself.\
\
You can also specify a path with a wildcard for the DNAS server to use
to find multiple configuration files to include e.g.
\'**include=streams/\*.conf**\'. This can then be used along with the
multiple stream configurations (see [section
4.12](#Stream_Configuration)) and the admin command
\'**admin.cgi?mode=reload**\' (see [section
5.1.2](#Administration_Pages)) to add or remove or update stream
configurations without having to close the server to apply them.

\
**admincssfile** : Specify the css styling to be used on the index.html
and admin pages *\[Default = v2\]*

This can accept the following parameters:

admincssfile=v1 - Uses the 1.x DNAS style\
admincssfile=v2 - Uses the newer Shoutcast 2 style (default)\
admincssfile=path_to_local_css_file e.g. my_index.css

    If using a custom css file, if it does not exist on the first try to load it, the server
    will revert to the default css style. As well the style is cached once loaded so
    changes require a clearing of the cache via 'admin.cgi?mode=clearcache'
    (see section 5.1.2).

\
**faviconfile** : Specify the file to be returned as the favicon.ico
when the administration pages are being queried by a browser *\[Default
= \<no value\>\]*

The default behaviour is to use a Shoutcast themed built-in icon file
and support / handling the update of this will entirely depend on the
browser.

\
**faviconmimetype** : Specify the mime type for actual file to be served
in the favicon.ico response *\[Default = image/x-icon\]*

Ensure this is correct for the type of image being used so it is valid.

\
**robotstxtfile** : Specify the file to be returned as the robots.txt
when queried by search engines, etc to attempt to prevent incorrect
access to the server\'s pages which may cause invalid listener
connections *\[Default = \<no value\>\]*

The default behaviour is to return a robots.txt reponse indicating not
to look at any of the server\'s pages i.e.

**User-agent:\*\
Disallow:/**

\
**metainterval** : Specify the metadata transmission interval in bytes
*\[Default = 16384\]*

    This is only used for 1.x based listener connections
    which indicate they support the in-stream metadata.

\
**uvoxcipherkey** : Specify the key used to obfuscate the initial
handshaking with the source *\[Default = foobar\]*

    This is a feature only of Shoutcast 2.x.

Only change this if you really need to do so as not all Shoutcast 2.x
clients will allow you to edit this value from the default value. If
using the Source DSP plug-in then see [Source DSP - section
5.0](http://wiki.shoutcast.com/wiki/Source_DSP_Plug-in#SHOUTcast_2_Cipher_Key)
for details on how to change the plug-in to use a different value.

\
**pidfile** : Specify the file used to store the process id for the
running DNAS instance *\[Default = sc_serv\_\<portbase\>.pid\]*

    The default is to create the sc_serv_<portbase>.pid
    file in the same folder as the DNAS is being run from.

To override this, specify the full filename required (if just wanting to
change the name of the file) or the full filepath (including name) to
change where it is also saved.\
To disable this functionality, specify a blank pidfile entry in the
configuration file e.g. **pidfile=**

\

[]{#Networking}

## 4.8. Networking [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\
**adminpassword** : Specify the administrator password for accessing the
remote server features *\[Default = \<no value\>\]*

    This cannot be the same as 'password' and also this can only
    be changed by editing the configuration file and a restart.

**password** : Specify the password for broadcasters when connecting to
the server *\[Default = \<no value\>\]*

\

**portbase** : Specify the port which listeners, sources and web
requests use to connect to the server *\[Default = 8000\]*

    Shoutcast 1 sources are only able to connect to 'portbase + 1' though
    in the source configuration you must specify the value of 'portbase'.

\
**publicport** : Specify the port reported to the YP server and used in
the direct playlists provided by the DNAS server when using port-mapping
for example on the host which can otherwise cause listeners to be
provided an incorrect stream address *\[Default = \<no value\>\]*

    If this is not specified then 'portbase' will be used as is the existing port
    handling behaviour of all DNAS server versions before this was added.

\
**portlegacy** : Specify the port which legacy 1.x sources use to
connect to the server if normal behaviour (portbase+1) is not
appropriate or needs to be disabled *\[Default = \<no value\>\]*

    Only use this option if you have a real reason and know what it can break.

If this option is not specified then \'**portbase**\' will be followed
as per existing behaviour, otherwise it will be used and legacy 1.x
sources will need to connect on \'**portlegacy - 1**\' e.g.
portlegacy=8001 then in the legacy 1.x source settings it will need to
have 8000 entered as the port to be used.

If this is set to zero then this will disable legacy 1.x source
connections so only 2.x sources will be able to connect to the server on
\'**portbase**\'.

\
**alternateports** : Specify additional ports which listeners will be
able to connect to the server *\[Default = \<no value\>\]*

This is specified as a comma separated string e.g.
**alternateports=80,8080** and will only provide listener responses i.e.
none of the admin or /index.html pages will respond on these ports, just
the audio stream.

This is provided as a way to help improve connectivity to any of the
streams provided from the server for cases where external firewalls are
blocking listener access to the stream on the main port.

These ports are not used by the DNAS server in its main playlist
responses (note: they are included in any default flash policy responses
as applicable to ensure listener compatibility) - this does not prevent
you from using them as alternate links in other services or on your own
website, etc.

\
**autodumptime** : Specify how long before an idle connection is dumped
from the server (in seconds) *\[Default = 30\]*

    A value of zero means there is no timeout of an idle connection. If you set this
    too low then it is likely that valid sources will fail to connect during the initial
    stages of a source connection and listener connections may timeout unexpectedly.

\
**maxheaderlinesize** : Specify the maximum size of an HTTP header line
*\[Default = 4096\]*

**maxheaderlinecount** : Specify the maximum header lines in an HTTP
style exchange *\[Default = 100\]*

**namelookups** : Enable to allow reverse DNS look-ups on incoming IP
addresses *\[Default = 0\]*

    It is not guaranteed that a listener connection provides a DNS name which can be shown and it
    is more common to just see the raw IP address of the listener even if this option has been enabled.

\

\
**\<MULTI\>** (one set for each stream configuration):

**streamportlegacy** : Specify the stream specific port which legacy 1.x
sources use to connect to the server if normal behaviour (portbase+1) is
not appropriate or needs to be overriden *\[Default = \<no value\>\]*

    Only use this option if you have a real reason and know what it can break.

If this option is not specified then \'**portbase**\' will be followed,
otherwise it will be used and legacy 1.x sources will need to connect on
\'**streamportlegacy - 1**\' e.g. streamportlegacy=8001 then in the
legacy 1.x source settings it will need to have 8000 entered as the port
to be used.

    Important Note: This is an experimental feature and will work,
    however title updates from most legacy 1.x sources will not work
    due to them expecting to send title updates to 'portbase' which
    is no longer the case when this option is enabled.

    You will need to send any title updates manually using the 'updinfo'
    method (see section 5.1.2) or update to use a 2.x compatible source.

\

[]{#Network_Buffers}

## 4.9. Network Buffers [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**buffertype** : Specify whether the buffer size is fixed \[0\] or
adaptive \[1\] *\[Default = 1\]*

**adaptivebuffersize** : Specify the buffer size in seconds if buffer is
set to adaptive *\[Default = 5\]*

**fixedbuffersize** : Specify the buffer size in bytes if the buffer is
set to fixed *\[Default = 1048576\]*

**bufferhardlimit** : Specify the maximum buffer size in bytes which it
can never go above *\[Default = 16777216\]*

\

[]{#Relaying}

## 4.10. Relaying [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**allowrelay** : Enable to allow a relay to connect to the server
*\[Default = 1\]*

**allowpublicrelay** : Enable to allow relays to list themselves in the
YP directory *\[Default = 1\]*

**relayreconnecttime** : Specify how many seconds to wait to reconnect
on a relay failure *\[Default = 5\]*

    Setting this to 0 will disable attempts for the relay to reconnect.

**relayconnectretries** : Specify the number of times relays are
attempted to be connected to if it is initially unable to connect
*\[Default = 0\]*

    A value of zero means there is no limit on the number
    of attempts made to reconnect to the relay source.

If a minimum or maximum bitrate is specified on the stream either via
the minbitrate / maxbitrate or streamminbitrate / streammaxbitrate
configuration options (see [section 4.12](#Stream_Configuration)) and an
invalid bitrate is detected, only one attempt is made to connect to the
relay source. A manual re-connect can be started.

**maxhttpredirects** : Specify the maximum number of times we can
redirect when relaying *\[Default = 5\]*

\
*\<Legacy Options\>*

**relayport** : Port of the source to use for the relay *\[Default =
80\]*

**relayserver** : Address of the source to relay *\[Default =
\<no value\>\]*

    Using the stream configuration options (see section 4.12) is the preferred method
    of setting up a relay. These options are only provided as a means for loading
    legacy configuration files. If found then these are mapped to 'streamrelayurl_1'.

\

[]{#Reserved_List}

## 4.11. Reserved List [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

    It is possible to use hostnames as well as a raw IP address but for this
    to work fully it requires namelookups=1 (see section 4.8) to be enabled.

**riponly** : Only allow listener connections from those in the reserved
list *\[Default = 0\]*

    This will always allow connections made from 127.0.0.1 (localhost) or 127.0.1.1
    even if it is not added to the reserved list to allow local monitoring of output.

**ripfile** : File to store the list of reserved IP and host addresses
*\[Default = sc_serv.rip\]*

**saveriplistonexit** : Write any changes to the \'ripfile\' when
required *\[Default = 1\]*

    If you are using a folder for saving the file into then you need to ensure that the
    folder already exists as the DNAS server will not attempt to the create the folder.

\

[]{#Stream_Configuration}

## 4.12. Stream Configuration [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**Important Note:** If you do not specify an identifier (\_#) on the end
of the above options then it will be treated like \_1 (effectively
acting like a 1.x DNAS). As well, \_0 is not a supported identifier and
will be mapped to \_1.

\
**requirestreamconfigs** : Only allow sources to connect if a stream
configuration has been set in our configuration file *\[Default = 0\]*

    When enabled you will need to ensure that any sources have their
    configuration details setup to match those in the configuration file,
    and in particular the 'streamid' and 'password' values.

**minbitrate** : Specify the minimum bitrate allowed in bits per second
for streams connected to the server which is enforced when the source
connection is made.*\[Default = \<no value\>\]*

    If this is not specified then no check of the bitrate is made as the source
    connects. This is used in conjunction with 'streamminbitrate' to enable
    per-stream as well as global control of the bitrate of source connections.

**maxbitrate** : Specify the maximum bitrate allowed in bits per second
for streams connected to the server which is enforced when the source
connection is made.*\[Default = \<no value\>\]*

    If this is not specified then no check of the bitrate is made as the source
    connects. This is used in conjunction with 'streammaxbitrate' to enable
    per-stream as well as global control of the bitrate of source connections.

\
**\<MULTI\>** (one set for each stream configuration):

**streamid** : Specify the numerical identifier of the stream for
control or referencing the stream configuration. This can only be a
numeric value from 1 to 2147483647.

If you use multiple stream configurations then you will need to ensure
the \_X part is specified and correct for each stream configuration
group e.g.

streamid=1\
streampath=random\
*or*\
streamid_1=1\
streampath_1=random_stream_path\
streamid_2=2\
streampath_2=another_stream_path

**streamauthhash** : The authorisation key needed for YP2 directory
registration.

    This is a requirement for using the YP2 system and without it you will
    not be able to successfully connect to the YP2 directory (see section 3.0).

    This can be used for multiple streams you are providing or can be different
    (as long as valid) so you can infact provide multiple stations from the same
    server if desired.

**streampath** : Specify the path listeners need to use to access the
stream.

    If a / is not specified at the start of the path then the server will add it to
    the generated path in all uses of the streampath as required so that
    http://<serverurl>/<streampath> will always provide a value url for listeners.

    If this is not specified for a stream, http://<serverurl>/ is the path used to
    access streamid=1 whilst http://<serverurl>/stream/<streamid>/ is the path
    for all other stream configurations. This difference allows for better legacy
    handling with 3rd party tools. See section 6.0 for more information on the
    server's stream address support.

**streamrelayurl** : Specify the full url of source to relay (if this is
a relay).

    Make sure if you use this that the full url is entered and that it is the
    url which listeners would connect to for the stream to be relayed.

**streambackupurl** : Specify the full url of a source stream to be used
as an alternative incase the normal source for the stream (be it a
direct connection or as part of a relay) disconnects. Unless the backup
is directly kicked, the DNAS will use the backup until the original
source reconnects or is found to be running again when used with a relay
source configuration.

    Make sure if you use this that the url entered is available and
    can be assumed to be a reliable backup source for the stream.

The backup cannot be the same as the original relay source and if this
happens then the backup will not be used e.g. using
server:8000/stream/1/ when the original stream is server:8000/stream/1/.
This does not prevent the use of another stream provided on the same
server being used as the backup e.g. server:8000/stream/2/ for
server:8000/stream/1/.

The backup source specified needs to be in the same format and bitrate
as the original stream to ensure it will not cause listeners problems.
The details of the stream will be checked against the prior source and
the backup source will not be used if the stream details do not match.

If specified for a relay source (via \'streamrelayurl\'), if the relay
source fails then the backup source is used (if available) as well as
the server attempting to reconnect to the original relay source. As soon
as the original relay source is found to be running again, the server
will automatically switch back to using it inplace of the backup source.

**streammaxuser** : Specify the maximum number of listeners allowed to
connect to the stream \[*Default = 0*\]

    If set to zero, not specified or higher than 'maxuser' then the value
    set for 'maxuser' (see section 4.2) will be used for all streams.

Changing this to a value between zero and \'maxuser\' will enforce the
listener connection limit for the specified stream e.g.

streammaxuser_1 = 8\
maxuser = 32

This allows a total of 32 listeners to the server but specifies the
maximum number of listeners to the first stream as 8.\
\
With the following configuration:

streammaxuser_1 = 64\
maxuser = 32

This allows a total of 32 listeners on the server but with a per stream
limit above the maximum means the maximum number of listeners to the
first stream group will be 32. However this also depends upon any other
stream configurations and their limits as to whether 32 listeners will
be able to connect to the stream.

Finally unless a valid stream configuration is specified then this value
will only be applied to the first stream configuration found i.e. there
is a need to specify a streamid_XXX for streammaxuser_XXX (where XXX is
the stream identifier of the stream configuration group.

\
**streamadminpassword** : Specify the administrator password for
accessing the remote server features for the specified stream
configuration group. If this is not specified then \'adminpassword\'
will need to be used.

**streampassword** : Specify the password for broadcasters to use when
connecting to the server for the specified stream. If this is not
specified then \'password\' will need to be used.

**streampublicserver** : This allows you to override the public flag
received from the source when a connection is being made to the YP
directory. If this is not specified or is set to empty then
\'publicserver\' will be used.

**streamallowrelay** : Enable to allow a relay to connect to the server.
If this is not specified then \'allowrelay\' will be used.

**streamallowpublicrelay** : Enable to allow relays to list themselves
in the YP directory. If this is not specified then \'allowpublicrelay\'
will be used.

**streamriponly** : Enable to only allow connections to be made from
reserved list addresses. If this is not specified then \'riponly\' will
be used.

**streamautodumptime** : Specify how long before an idle connection will
be dumped from the server (in seconds). A value of zero means there is
no timeout of an idle connection. If not specified then
\'autodumpsourcetime\' will be used.

**streamautodumpusers** : Enable to allow the server to disconnect
listeners if the source disconnects. If not specified then
\'autodumpusers\' will be used.

**streamlistenertime** : Specify the maximum time in minutes a listener
is allowed to listen to the stream. A value of zero means there will be
no time limit. If not specified then \'listenertime\' will be used.

**streamintrofile** : File to play when a listener first connects to the
server. If this is not specified then \'introfile\' will be used. See
[section 4.5](#Introduction_and_Backup_Files) for details about using
this option.

**streambackupfile** : File to play if the source disconnects from the
server when a listener is still connected or when there is no source
connected. If this is not specified then \'backupfile\' will be used.
See [section 4.5](#Introduction_and_Backup_Files) for details about
using this option.

**streambackuptitle** : The title to provide if the stream source is not
connected when a listener connects to the stream only if a backup file
has been correctly configured. If this is not specified then
\'backuptitle\' will be used. If that is also not specified then a
cleaned version of the backup filename will be used. See [section
4.5](#Introduction_and_Backup_Files) for details about using this
option.

**streambackuploop** : The number of times to play the configured backup
file to a listener when there is no source connected. If this is not
specified then \'backuploop\' will be used. See [section
4.5](#Introduction_and_Backup_Files) for details about using this
option.

**streamagentfile** : File to store the list of blocked user agents. If
this is not specified then \'agentfile\' will be used.

**streamartworkfile** : File to use for the experimental stream branding
artwork support for 1.x based streams. If this is not specified then
\'artworkfile\' will be used.

**streambanfile** : File to store the list of banned IP addresses. If
this is not specified then \'banfile\' will be used.

**streamripfile** : File to store the list of reserved addresses. If
this is not specified then \'ripfile\' will be used.

**streamw3clog** : File to store the web connections logs into. If this
is not specified then \'w3clog\' will be used.

**streamsonghistory** : Specify the maximum song history to preserve
*\[Default = 10\]*

    If not specified then the value set for 'songhistory' (see section 4.16) will be used
    for all known streams.

    If set to zero, no song history will be preserved for the specified stream and the
    played?sid=# page for the stream will be hidden from view on the header of the
    /index.html?sid=# page.

**streamminbitrate** : Specify the minimum bitrate allowed in bits per
second of the stream which is enforced when the source connection is
made. If this is not specified then \'minbitrate\' will be used as
appropriate to its value.

**streammaxbitrate** : Specify the maximum bitrate allowed in bits per
second of the stream which is enforced when the source connection is
made. If this is not specified then \'maxbitrate\' will be used as
appropriate to its value.

**streamhidestats** : Specify control of which public pages can be
viewed for the stream.

This can accept the following parameters:

**streamhidestats=stats**  →  redirects the /stats?sid=# and
/statistics?sid=# pages\
**streamhidestats=all**  →  redirects the /index?sid=#, /played?sid=#
pages, /currentsong?sid=#, /nextsong?sid=# and /nextsongs as well as
those from streamhidestats=stats

**streamredirecturl** : Specify a page to be used as a redirect page
when hidestats or the stream specific streamhidestats options are
enabled.

**streammovedurl** : Specify an url to provide to listeners when the
access the stream for when it has moved to a different server or has
been retired and you want to move listeners from the existing stream to
the new stream specified. This mode will prevent any sources from being
connected for the stream.

**sslCertificateFile** : Specify an SSL Cert file for unlocking Premium
https stream support in v2.6 and newer, e.g. ssl.crt

**sslCertificateKeyFile** : Specify an SSL Cert key for unlocking
Premium https stream support in v2.6 and newer, e.g. key.pem

\

[]{#Premium}

## 4.13 Premium Unlock (v2.6) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**userid** : Enter the corresponding value from \"Your Plan\" in the
online RadioManager to unlock the Premmium features

**licenceid** : Enter the corresponding value from \"Your Plan\" in the
online RadioManager to unlock the Premmium features

\

[]{#Web_Connection_(W3C)_Logging}

## 4.14. Web Connection (W3C) Logging [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**w3cenable** : Enable logging of web connections to describe the
duration a listener has listened to a specific title *\[Default = 1\]*

**w3clog** : File to store the web connections logs into *\[Default =
sc_w3c.log\]*

    If you are using a folder for saving the file into then you need to ensure that the
    folder already exists as the DNAS server will not attempt to the create the folder.

For per-stream handling, the streamw3clog configuration option needs to
be used. See (see [section 4.12](#Stream_Configuration)) for more
information on how to make such a setup.

\

[]{#YP_Server_Behaviour}

## 4.15. YP Server Behaviour [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**ypaddr** : Allows you to specify a different YP server if required
*\[Default = yp.shoutcast.com\]*

**ypport** : Allows you to specify the port of the YP server if required
*\[Default = 80\]*

**yppath** : Allows you to specify the path to YP2 services on the
server *\[Default = /yp2\]*

**yptimeout** : Specify the timeout interval in seconds for requests
made to the YP server *\[Default = 30\]*

    The actual interval between requests can be up to a few seconds longer
    depending on the action being carried out and the handling of any errors.

**ypmaxretries** : Specify the maximum number of times a YP request will
be attempted *\[Default = 10\]*

    This is related to the actual attempts to make and get a valid
    HTTP response from the YP server for the requested action(s).

**ypreportinterval** : Specify the maximum time in which the YP must
have contacted our server in seconds *\[Default = 300\]*

**ypminreportinterval** : Specify the minimum time in which the YP can
contact our server in seconds *\[Default = 10\]*

\
**publicserver** : This allows you to override the public flag from the
connected source when a connection is being made to the YP directory
*\[Default = default\]*

This can be one of the following values:

- **default**   -   use the flag provided by the source
- **always**   -   force the source to be public
- **never**     -   never allow the use the flag provided by the source

If this or the stream specific version is enabled, the server will keep
trying to get a valid response to allow it to be listed in the Directory
such as if there is a loss of internet connection or an error with the
stream(s) being seen by the Directory tester for example.

\

[]{#YP_Server_Errors}

## 4.16. YP Server Errors [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

There is nothing to configure since the deprecation of the \'yp2\'
configuration options. This section is provided as a means to better
understand some of the YP errors which occur.

If not all of the required values are set for a public listing, the DNAS
server will throw an error and will abort trying to be listed in the
Shoutcast Directory. It should be indicated the error is with one of the
error codes provided below so it can be resolved.

Additionally if there is an issue during Directory updates or removals,
then the server will report an error in its log ouput as one of the
following error codes and \<message\>.

  ---------- ---------------------------------------------------------------------------------------------------------------------------
  **Code**   **Message**
  400        Generic error (covers all other cases usually from internal failures)
  457        Unrecoverable error while updating station information - DNAS restart required.
  470        Invalid authorization hash
  471        Invalid stream type (could be a bad bitrate or mime type)
  472        Missing or invalid stream url
  473        Server unreachable by YP
  474        Relay url does not exist
  475        Invalid server ID
  476        Invalid max clients (value out of range or missing)
  477        Terms of Service violator. You are being reported.
  478        Incompatible protocol.
  479        Streams requiring authorization are not public and cannot list here.
  480        Cannot see your station/computer (URL: \<streamurl\>) from the Internet, disable Internet Sharing/NAT/firewall/ISP cache.
  481        Cannot verify server since all listener slots are full. Please wait.
  482        This network has been permanently banned due to a previous violation of the Shoutcast directory terms of service
  483        Invalid listeners (value out of range / missing)
  484        Invalid avglistentime (value out of range / missing)
  485        Invalid newsessions (value out of range / missing)
  486        Invalid connects (value out of range / missing)
  487        Request & Response objects are null
  488        Request xml is null
  489        YP command not specified
  490        Generic error, while doing xml parsing
  491        Generic error, while reading xml request
  492        Error closing buffer / HTTP connection / object / statement / etc
  493        Internal error - unable to acquire data source
  494        Error updating information - DNAS restart required
  495        Error acquiring station ID - DNAS restart required
  496        Error converting data type
  497        Inconsistent stream behaviour
  498        Invalid Request (Invalid request received)
  499        Error while getting information
  ---------- ---------------------------------------------------------------------------------------------------------------------------

\

[]{#Statistics}

## 4.17. Statistics [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**hidestats** : Specify control of which public pages can be viewed
*\[Default = \<no value\>\]*

This can accept the following parameters:

**hidestats=stats**  →  redirects the /stats and /statistics pages\
**hidestats=all**  →  redirects the /index, /played pages, /currentsong,
/nextsong and /nextsongs as well as those from hidestats=stats

\
**redirecturl** : Specify a page to be used as a redirect page when
hidestats or the stream specific \'streamhidestats\' options are enabled
*\[Default = \<no value\>\]*

\
Depending on how the \'hidestats\' and \'streamhidestats\' values have
been specified, there is an order they are used to redirect listeners
accessing the public pages. The following shows the order of preceedence
from highest (left) to lowest (right) with the per-stream options always
having the greatest priority.

\
If \'hidestats=stats\' or \'streamhidestats=stats\' are specified:

**streamredirecturl**  →  **redirecturl**  →  **/index.html** (default
for unknown pages)

If \'hidestats=all\' or \'streamhidestats=all\' are specified:

**streamredirecturl**  →  **streamurl** (taken from current source if
connected)  →  **redirecturl**  →  **403 (Service Forbidden)**

\
**songhistory** : Specify the maximum song history to preserve
*\[Default = 20\]*

    If set to zero, no song history will be preserved for any streams and the /played.html
    page for any streams will be hidden from view on the header of all /index.html pages.

\

[]{#UserAgents}

## 4.18. Blocked User Agents [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**blockemptyuseragent** : Specify if the server will allow listener
connections without a user agent or not. *\[Default = 0\]*

    Some hardware devices connecting as a listener e.g. for relaying may
    not provide a user agent. If enabling this, make sure it does not block
    any listener connections you want to have connected to the server.

**agentfile** : File to store the list of blocked user agents *\[Default
= sc_serv.agent\]*

**saveagentlistonexit** : Write any changes to the \'agentfile\' when
required *\[Default = 1\]*

    If you are using a folder for saving the file into then you need to ensure that the
    folder already exists as the DNAS server will not attempt to the create the folder.

\

[]{#Artwork}

## 4.19. Artwork (Experimental) [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

**artworkfile** : File to use for the experimental stream branding
artwork support for 1.x based streams. *\[Default = \<no value\>\]*

    This allows for streams fed by a legacy 1.x source to be able to provide
    in-stream branding artwork for compatible 1.x and 2.x listener clients as
    well as via any streamart?sid=# calls made to the DNAS (see section 5.1.1).

The raw size of the stream branding artwork file can be up to 523872
bytes (approx. half a megabyte) and should be either JPEG, PNG, GIF or
BMP with the correct file extension for the format of the file being
used.

More information on how to access the in-stream metadata for 1.x based
listener clients can be found at the [Shoutcast
Wiki](http://wiki.shoutcast.com/wiki/SHOUTcast_Developer).

\
**Important Notes:**\
\
This is an experimental feature and generally works but there may be
some issues with it e.g. needing to disconnect the stream source when
the artwork has changed after a configuration reload has been made.

This is only intentionally applied to any streams using a legacy 1.x
based source client (either a direct source or a relay source) which
does not already make use of the 1.x protocols support for providing a
related URL as part of the in-stream metadata (which is the norm for
most legacy 1.x based source clients and relays).

This will not be applied to streams fed by a 2.x based source client as
a 2.x source client should be capable of natively providing stream
branding artwork as well as now playing artwork (as long as it is no
more than 523872 bytes in size in the format used). If the 2.x source
client you are using does not support providing at least stream branding
artwork support, you should make a feature request to the author since
you are missing out on a key part of the 2.x platform.

\

[]{#Administration}

## 5. Administration [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![Example Administration Page Showing the Server Source Connection
Page](res/Server_Source_Connection_Page.png){.thumb}](res/Server_Source_Connection_Page.png "Example Administration Page Showing the Server Source Connection Page")
:::

The DNAS server provides administration pages for accessing and
controlling the DNAS server remotely, which allows you to monitor and
control listener connections, through to accessing general statistics.

\
These pages can now be accessed through the streams summary page at
**/index.html?sid=0** which will show a link to any active stream(s) or
you explicitly access them via the **/index.html?sid=#** path where
**\#** is the ID of the stream (see [section
4.12](#Stream_Configuration) for more about using \'streamid\') e.g.
\<serverurl\>/index.html?sid=1

\
If no **\'sid\'** parameter is passed and if there is only one stream
active then you will be taken to its summary page. If an invalid
**\'sid\'** parameter is received, then you will be taken to the streams
summary page at **/index.html?sid=0**

\
As an alternative to using the **\'streamid\'** to access stream
specific pages, **\'streampath\'** can also be used to access the stream
pages. If the streampath specified can be matched to a valid streamid
then the requested action is performed, otherwise the no sid or an
invalid sid behaviour is used.

The syntax is **sp=\<streampath\>** where **\<streampath\>** can be
either the value specified by the \'streampath\' configuration option or
it can be a default streampath as detailed in the server\'s stream
address support in [section 6.0](#Stream_Addresses). The following
examples show how to access the same page using either the streamid or
the streampath method:

**\<serverurl\>/index.html?sp=/ → \<serverurl\>/index.html?sid=1**\
\
**\<serverurl\>/index.html?sp=/stream/2/ →
\<serverurl\>/index.html?sid=2**\
\
If the streampath for stream #3 is configured as streampath_3=Live\
**\<serverurl\>/index.html?sp=Live → \<serverurl\>/index.html?sid=3**

\

[]{#Administration_Pages}

## 5.1. Administration Pages [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

The administrative features provided can be split into public and
private pages, with all private pages requiring a password to access
them. Unless public pages have been disabled or set to be redirected,
then no password is needed to access them and anyone is able to access
them.

If public pages are configured to be disabled or redirected, then a
password can still be used to access the page as detailed in the
following sections. Additionally some of the public pages provide more
information if a valid password is provided.

    When accessing any of the public and private pages
    which require a username, the username is 'admin'.

\

[]{#Public_Pages}

## 5.1.1. Public Pages [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

::: thumb
[![Streams Summary
Page](res/Streams_Summary_Page.png){.thumb}](res/Streams_Summary_Page.png "Streams Summary Page")
:::

  ---------------------- -------------------------------------------------------------
  **index.html?sid=0**   Shows the streams summary page showing any active stream(s)
  ---------------------- -------------------------------------------------------------

  ----------------------- -----------------------------------------------------------
  **currentsong?sid=#**   Returns the current song title or a null response
  **nextsong?sid=#**      Returns the next song title (if known) or a null response
  ----------------------- -----------------------------------------------------------

\

    currentsong and nextsong provide UTF-8 encoded copies of the song title,
    otherwise they return effectively a no response (ignoring the http header).

\

  ---------------------------------------------- --------------------------------------
  **nextsongs?sid=#**\                           Returns the next song title(s) in the
  **nextsongs?sid=#&json=1**\                    requested format to be played when
  **nextsongs?sid=#&json=1&callback=function**   using a 2.x stream source. See
                                                 [section
                                                 5.2](#XML_/_JSON_/_JSON-P_Responses)
                                                 for more details on the format of the
                                                 response returned.

  ---------------------------------------------- --------------------------------------

::: thumb
[![Stream Summary
Page](res/Stream_Summary_Page.png){.thumb}](res/Stream_Summary_Page.png "Stream Summary Page")
:::

\

  ---------------------- ----------------------------------------------
  **index.html?sid=#**   Shows current status of the specified stream
  ---------------------- ----------------------------------------------

  ---------------------------------------------- --------------------------------------
  **played.html?sid=#**\                         Song history of the specified stream
  **played?sid=#**\                              in the requested format (if no
  or\                                            \'type\' parameter is specified then
  **played?sid=#&type=xml**\                     the HTML version will be provided).
  **played?sid=#&type=json**\                    See [section
  **played?sid=#&type=json&callback=function**   5.2](#XML_/_JSON_/_JSON-P_Responses)
                                                 for more details on the format of the
                                                 response returned.

  ---------------------------------------------- --------------------------------------

\

  ----------------------------------- -----------------------------------
  **listen.pls?sid=#**\               Provides a PLS file for clients to
  **listen?sid=#**                    use to connect to the stream.

  **listen.m3u?sid=#**                Provides a M3U file for clients to
                                      use to connect to the stream.

  **listen.asx?sid=#**                Provides a ASX file for clients to
                                      use to connect to the stream.

  **listen.xspf?sid=#**               Provides a XSPF file for clients to
                                      use to connect to the stream.

  **listen.qtl?sid=#**                Provides a QTL file for clients to
                                      use to connect to the stream.
  ----------------------------------- -----------------------------------

\

    With the listen pages you either need to have specified an address with 'destip'
    (see section 4.2) or leave empty and allow the server to attempt to auto-generate
    the address required for the client to be able to connect. Also if listed in the
    Directory and there is a backupserver, then it will output it as a second entry.

\

  ----------------------------------- -----------------------------------
  **home.html?sid=#**\                Opens in a new window or tab
  **home?sid=#**                      (depending on the client browser)
                                      the \'streamurl\' as specified by
                                      the stream source. If this is not
                                      set then the client will be
                                      redirected to the shoutcast.com
                                      main page.

  ----------------------------------- -----------------------------------

\

  ------------------------------------------------------------ ------------------------------------------
  **stats?sid=#**\                                             Provides a summary of information about
  **stats?sid=#&json=1**\                                      the stream. This matches the private
  **stats?sid=#&json=1&callback=function**\                    administrator version from
  **stats?sid=#&json=1&callback=function&pass=\<password\>**   **admin.cgi?sid=#&mode=viewxml&page=1**\
                                                               If no **\'sid\'** is specified, the
                                                               response provided is from either stream #1
                                                               or the only active stream.

  ------------------------------------------------------------ ------------------------------------------

\

    This is the modern version of the 7.html page as provided by legacy 1.x DNAS
    server. See section 5.2 for more details on the format of the response returned.

\

  ------------------------------------ -----------------------------------
  **7.html?sid=#**\                    Provides a reduced set of
  **7.html?sid=#&pass=\<password\>**   information about the specified
                                       stream which is compatible with
                                       reporting tools only compatible
                                       with 1.x DNAS servers. For more
                                       detailed information about the
                                       stream use the \'**stats**\'
                                       request.

  ------------------------------------ -----------------------------------

\

  ----------------------------------------------------------- -----------------------------------
  **statistics**\                                             Provides a summary of information
  **statistics?json=1**\                                      about any known and connected
  **statistics?json=1&callback=function**\                    streams. This is the same
  **statistics?json=1&callback=function&pass=\<password\>**   information as shown via
                                                              **stats?sid=#** and additionally
                                                              provides consolidated statistics
                                                              including the total number of
                                                              clients connected to the server
                                                              across all streams.

  ----------------------------------------------------------- -----------------------------------

\

    stats?sid=#, statistics and 7.html?sid=# methods support &pass=<password> on the request.
    This works like the normal mode but only allows access when 'hidestats' is enabled if the
    password matches to one allowing access to the stream's admin pages or source connections.

\

  ----------------------------------- -----------------------------------
  **streamart?sid=#**\                Displays the artwork 2.x compatible
  **playingart?sid=#**\               clients (e.g. Winamp 5.64 and up)
                                      may be able to display if the 2.x
                                      source (if being used) provides it.

  ----------------------------------- -----------------------------------

\

  ------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **shoutcast.swf**   Provides shoutcast.swf if found in the same folder as the sc_serv\[.exe\] file is located for providing custom flash players to resolve some access issues so it comes from the same domain as the DNAS server.
  ------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

\

[]{#Private_Pages}

## 5.1.2. Private Pages [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

::: thumb
[![Server Summary
Page](res/Server_Summary_Page.png){.thumb}](res/Server_Summary_Page.png "Server Summary Page")
:::

    By passing &pass=<password> where password is the 'adminpassword' (see section 4.8)
    then it is possible to directly access the administration page(s) required. As well the
    base64 encoded version of the password can be passed as long as it is prefixed with
    YWRtaW46 e.g.&pass=changeme is the same as &pass=YWRtaW46Y2hhbmdlbWU=

  ----------------------------------- -----------------------------------
  **admin.cgi**\                      Shows the an overall server summary
  \                                   page for the streams provided by
  **admin.cgi?sid=0**                 the server including direct links
                                      to certain information pages (see
                                      notes about the
                                      **admin.cgi?sid=#&mode=viewxml**
                                      command for more info)

  ----------------------------------- -----------------------------------

::: thumb
[![Stream Admin
Page](res/Stream_Admin_Page.png){.thumb}](res/Stream_Admin_Page.png "Stream Admin Page")
:::

  --------------------- ------------------------------------------------------
  **admin.cgi?sid=#**   Shows the stream admin page for the specified stream
  --------------------- ------------------------------------------------------

\

**admin.cgi?sid=#&mode=updinfo&song=title**

If \'**title**\' is valid then the current title for the stream
specified will be changed.

**admin.cgi?sid=#&mode=updinfo&url=myurl**

If \'**myurl**\' is valid then the current songurl for the stream
specified will be changed.

**admin.cgi?sid=#&mode=updinfo&dj=the_dj_name**

If \'**dj**\' is valid then the current DJ for the stream specified will
be changed.

\
The \'**song**\', \'**url**\' and \'**dj**\' parameters can be sent at
the same time and are used until the next use of this method or the next
title update is received from the source. This will accept 2.x XML
metadata or 1.x text only titles and will automatically handle them as
applicable to the data received by the command.

::: thumb
[![Server Log
Page](res/Server_Log_Page.png){.thumb}](res/Server_Log_Page.png "Server Log Page")
:::

\

  ----------------------------------------------- -------------------------------------------
  **admin.cgi?sid=#&mode=viewlog**                View logfile
  **admin.cgi?sid=#&mode=viewlog&viewlog=tail**   View logfile (tailing)
  **admin.cgi?sid=#&mode=viewlog&viewlog=save**   Save logfile as a gzip compressed archive
  ----------------------------------------------- -------------------------------------------

\

    The tailing option keeps adding additional log entries to the end of the log
    view once the current log has been loaded as long as the view is kept open.

::: thumb
[![Stream Ban List
Page](res/Stream_Ban_List_Page.png){.thumb}](res/Stream_Ban_List_Page.png "Stream Ban List Page")
:::

\

  ---------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=viewban**   Ban view which matches the ban file and allows you to ban a single IP or an IP range from it (see section 4.1 for more info on the file)
  ---------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------

::: thumb
[![Stream Reserved List
Page](res/Stream_Reserved_List_Page.png){.thumb}](res/Stream_Reserved_List_Page.png "Stream Reserved List Page")
:::

\

  ---------------------------------- --------------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=viewrip**   Reserved list that matches the rip file (see section 4.11 for more info on the file)
  ---------------------------------- --------------------------------------------------------------------------------------

::: thumb
[![Stream Blocked User Agent
Page](res/Stream_Blocked_User_Agent_List_Page.png){.thumb}](res/Stream_Blocked_User_Agent_List_Page.png "Stream Blocked User Agent List Page")
:::

\

  ------------------------------------ --------------------------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=viewagent**   Blocked user agent list that matches the agent file (see section 4.17 for more info on the file)
  ------------------------------------ --------------------------------------------------------------------------------------------------

\

  ------------------------------------------ -----------------------------------
  **admin.cgi?sid=#&mode=art**\              Displays the artwork 2.x compatible
  **admin.cgi?sid=#&mode=art&art=playing**   clients (e.g. Winamp 5.64 and up)
                                             may be able to display if the 2.x
                                             source (if being used) provides it.

  ------------------------------------------ -----------------------------------

\

    If no '&art=' is specified or not a matching option then the stream artwork
    (if available) will be shown. If no '&art=playing' is specified then this will
    show the playing file's artwork (if available).

\

  ------------------------------------------------------------ -----------------------------------
  **admin.cgi?sid=#&mode=viewxml**\                            Returns output of the choosen
  **admin.cgi?sid=#&mode=viewxml&page=#**\                     stream information in the requested
  **admin.cgi?sid=#&mode=viewjson**\                           format (supporting XML / JSON /
  **admin.cgi?sid=#&mode=viewjson&page=#**\                    JSON-P).
  **admin.cgi?sid=#&mode=viewjson&page=#&callback=function**   

  ------------------------------------------------------------ -----------------------------------

If \'**page**\' is not set or is outside of the range 0 to 6 then this
will output all of the information as the default viewxml or viewjson
actions provide. Otherwise the response only displays information based
on the value assigned to the \'**page**\' value which can be from 1 to 6
and maps as follows:

  -------- --------------------------- ------------------------------------------------------------------------------------------------
  1  →     **Stream Summary**          This is the same as using the public **stats?sid=#** action
  2  →     **Not used**                Previously used for Webdata Stats but not in current builds
  3  →     **Listener Stats**          
  4  →     **Song History**            
  5  →     **Stream Metadata**         If supported by the source and can just be title
  6  →     **Stream Configurations**   Displays all of the known stream configurations though this is only available on **admin.cgi**
  -------- --------------------------- ------------------------------------------------------------------------------------------------

If accessing the standard viewxml or viewjson or the listener stats
(page = 3), you can also send **&iponly=1** which filters the listener
information (if there are any) to just output the IP instead of the full
information provided normally.

\

  ----------------------------------- -------------------------------------------------------
  **admin.cgi?sid=#&mode=resetxml**   Will flush the held stream information to refresh it.
  ----------------------------------- -------------------------------------------------------

\

  ---------------------------------- ---------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=kicksrc**   Will allow you to kick the currently connected source for the specified stream.
  ---------------------------------- ---------------------------------------------------------------------------------

\

  ------------------------------------------------------- -----------------------------------
  **admin.cgi?sid=#&mode=kickdst&kickdst=\<clients\>**\   Will allow you to kick the
  **admin.cgi?sid=#&mode=kickdst&kickdst=all**            currently connected client(s) for
                                                          the specified stream. The
                                                          \<clients\> parameter is a comma
                                                          separated list of the unique id or
                                                          IP address relating to the client.

  ------------------------------------------------------- -----------------------------------

\

  ----------------------------------------------- ------------------------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=ripdst&ripdst=\<IP\>**   Where \<IP\> is the IP or the hostname to be reserved (see section 4.11 for more information).
  ----------------------------------------------- ------------------------------------------------------------------------------------------------

\

  ------------------------------------------------- --------------------------------------------------------------------------------------------------
  **admin.cgi?sid=#&mode=unripdst&ripdst=\<IP\>**   Where \<IP\> is the IP or the hostname to be unreserved (see section 4.11 for more information).
  ------------------------------------------------- --------------------------------------------------------------------------------------------------

\

**admin.cgi?sid=#&mode=unbandst&bandst=\<IP\>.0&banmsk=0**

Where \<IP\> is the first 3 parts of a subnet IP to unban.

**admin.cgi?sid=#&mode=unbandst&bandst=\<IP\>&banmsk=255**

Where \<IP\> is that of a single IP to unban.

\

  ------------------------------------------------------- -----------------------------------
  **admin.cgi?sid=#&mode=agent&agent=\<user_agent\>**\    Will allow you to block clients
  \                                                       with the specified user agent from
  **admin.cgi?sid=#&mode=unagent&agent=\<user_agent\>**   connecting for the specified
                                                          stream.\
                                                          Where \<user_agent\> is that of a
                                                          single user agent to block.\
                                                          This will also kick any connected
                                                          clients (subject to the global or
                                                          stream specific configurations).

  ------------------------------------------------------- -----------------------------------

\

  ------------------------------- -----------------------------------------------------------------------------------------------------
  **admin.cgi?mode=bannedlist**   This will reload any configured banned list files from file without the need to restart the server.
  ------------------------------- -----------------------------------------------------------------------------------------------------

\

  -------------------------------- -------------------------------------------------------------------------------------------------------
  **admin.cgi?mode=reservelist**   This will reload any configured reserved list files from file without the need to restart the server.
  -------------------------------- -------------------------------------------------------------------------------------------------------

\

  ---------------------------------- -----------------------------------------------------------------------------------------------------------------
  **admin.cgi?mode=useragentlist**   This will reload any configured blocked user agent list files from file without the need to restart the server.
  ---------------------------------- -----------------------------------------------------------------------------------------------------------------

\

  ------------------------------------------ -----------------------------------
  **admin.cgi?mode=rotate**\                 This will rotate the log files set
  **admin.cgi?mode=rotate&files=log\|w3c**   via the \'logfile\', \'w3clog\' and
                                             \'streamw3clog\' options. If
                                             **&files=** is specified then
                                             passing log or w3c will allow you
                                             to only rotate one type of file
                                             otherwise both will be rotated by
                                             this command.

  ------------------------------------------ -----------------------------------

\

  ----------------------------------- -----------------------------------
  **admin.cgi?mode=clearcache**       This clears all cached copies of
                                      the following resources:\
                                      index.css, shoutcast.swf,
                                      crossdomain.xml, robots.txt and
                                      favicon.ico

  ----------------------------------- -----------------------------------

\

  ---------------------------- ----------------------------------------------------------------------------------------------------------
  **admin.cgi?mode=history**   Song history of the specified stream. This is the same as using the public **played.html?sid=#** action.
  ---------------------------- ----------------------------------------------------------------------------------------------------------

\

::: thumb
[![Server Bandwidth
Page](res/Server_Bandwidth_Page.png){.thumb}](res/Server_Bandwidth_Page.png "Server Bandwidth Page")
:::

  ----------------------------------------------------------- --------------------------------------
  **admin.cgi?mode=bandwidth**\                               This outputs bandwidth information
  **admin.cgi?mode=bandwidth&refresh=XX**\                    about the server e.g. amount of data
  **admin.cgi?mode=bandwidth&type=xml\|json**\                sent to clients. It will show a page
  **admin.cgi?mode=bandwidth&type=json&callback=function**\   with a formatted table or int the
                                                              requested format. See [section
                                                              5.2](#XML_/_JSON_/_JSON-P_Responses)
                                                              for more details on the format of the
                                                              response returned.

  ----------------------------------------------------------- --------------------------------------

\

  --------------------------------------------------------- -----------------------------------
  **admin.cgi?mode=ypstatus&type=xml**\                     This provides information on the
  **admin.cgi?mode=ypstatus&type=json**\                    listing state of all known streams
  **admin.cgi?mode=ypstatus&type=json&callback=function**   configured on the server in the
                                                            requested format.

  --------------------------------------------------------- -----------------------------------

\

  -------------------------------------- -----------------------------------
  **admin.cgi?sid=#&mode=startrelay**    Will attempt to start the
                                         configured relay for the specified
                                         stream.\
                                         If there is no relay url configured
                                         for the stream or there is a relay
                                         already running then nothing will
                                         be done.

  **admin.cgi?sid=#&mode=startrelays**   Will attempt to start all the
                                         configured relays.\
                                         If there is no relay url configured
                                         for the stream(s) or there is a
                                         relay already running then nothing
                                         will be done.

  **admin.cgi?sid=#&mode=kicksources**   Will attempt to stop all relays and
                                         kick all direct sources from the
                                         currently active streams.
  -------------------------------------- -----------------------------------

\
\
[]{#Config_Reload}

## 5.1.2.1. Configuration Reload [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

  ----------------------------------- -----------------------------------
  **admin.cgi?mode=reload**\          This reloads the stream
  **admin.cgi?mode=reload&force=1**   configuration details in the main
                                      configuration file the server used
                                      when started and is only available
                                      on the admin summary page and so
                                      can only be run by the master
                                      administrator password.

  ----------------------------------- -----------------------------------

This command works on the server as a whole (hence no sid parameter) and
it will add or remove or update any stream configuration as applicable
which will cause any connected sources and clients to be kicked as
applicable (usually if a stream configuration was removed).

This will recognise any configurations included via \'include\' entries
so you can have \'**include=streams/\*.conf**\' in your main
configuration file which the server can then use to detect different
stream configurations.

If \'**&force=1**\' is passed then the reload will treat the updating of
active stream configurations in the same manner as a stream
configuration removal instead of trying to update compatible stream
configuration details without resetting the stream e.g. not increasing
the \'streammaxuser\' when it could be increased.

\
The following configuration options are updated when using this command:

**\<\< global options \>\>**

password **(\*)**

publicserver

maxbitrate

maxuser

ypport

ypaddr

yptimeout

destip

hidestats

redirecturl

riponly

autodumptime

namelookups

requirestreamconfigs

cdn

relayreconnecttime

relayconnectretries

agentfile

blockemptyuseragent

publicip

artworkfile

songhistory

backuploop

minbitrate

\
**\<\< stream specific options \>\>**

streampassword **(\*)**

streamadminpassword **(#)**

streamallowrelay

streamauthhash

streamautodumptime

streamautodumpusers

streambackupfile

streambackupurl

streambanfile

streamid

streamintrofile

streamlistenertime

streammaxbitrate

streammaxuser

streampath

streamallowpublicrelay

streampublicserver

streamrelayurl

streamripfile

streamriponly

streamsonghistory

streamredirecturl

streamhidestats

streammovedurl

streamagentfile

streamartworkfile

streambackuploop

cdnmaster

cdnslave

streamminbitrate

\
all of the debugging configuration options (see section 4.3 for all
options)

**(\*)** This will depend upon the current values versus the new
configuration values\
**(#)** The master \'adminpassword\' can only be changed after a restart
of the server

\

[]{#XML_/_JSON_/_JSON-P_Responses}

## 5.2. XML / JSON / JSON-P Responses [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

As detailed in the previous sections, some of the administration actions
will provide the information in an XML / JSON / JSON-P response. For
information on what is returned in the XML responses see [Server XML
Responses](DNAS_Server_XML_Responses.html) and for JSON / JSON-P
responses see [Server JSON Responses](DNAS_Server_JSON_Responses.html).

\

[]{#Stream_Addresses}

## 6. Stream Addresses [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Listeners connecting to the streams provided by the DNAS server are able
to do so in a number of ways depending upon how the streams have been
configured and the number of streams available.

The main ways for a listener to connect to a stream is:

**\<serverurl\>/stream/\<streamid\>/**\
or\
**\<serverurl\>/** (if using default values for streamid = 1)\
or\
**\<serverurl\>/\<streampath\>**

\
**\<serverurl\>** is typically formed as http://destip:portbase (see
sections 4.2 and 4.8)\
**\<streamid\>** is the \'streamid\' set from the stream configuration
(see [section 4.12](#Stream_Configuration))\
**\<streampath\>** is the \'streampath\' set from the stream
configuration (see [section 4.12](#Stream_Configuration))

\
If the listener attempting to connect to the DNAS server does not
specify \<streampath\> or \<streamid\> in the stream url requested or if
only one stream is provided, then the server will default to the first
active stream. This will allow the listener to make a valid connection
and mirrors the 1.x DNAS server behaviour.

The handling of the stream addresses is something to keep in mind if you
are providing multiple streams, as this will allow you to provide
different addresses for certain listeners to be able to use a specific
stream e.g. if you wanted to have mobile clients connect to a lower
bandwidth stream then you could direct them to
\'**\<serverurl/mobile\>**\'.

\

[]{#HTTP_Protocol_Compatibility}

## 6.1. HTTP Protocol Compatibility [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    Since the 2.2.2 DNAS server release, the default behaviour is to provide
    HTTP compatible responses instead of the DNAS 1.x ICY style responses.

\
As of the **2.4.1** DNAS server release, support for the ICY protocol
has been completely dropped (the only exception is a compatibility
requirement for Windows Media Player) and all 1.x client connections are
now provided with HTTP responses e.g. **HTTP/1.0 200 OK** instead of
**ICY 200 OK** (which is used for a successful connect).

This has been done to improve player capatibility with HTML5 audio
players and other listener client software which previously struggled
with the ICY protocol (which was HTTP-like but not all that well
supported).

\
The DNAS will still provide in-stream metadata for listener clients
which specify a **icy-metadata:1** header on connection, otherwise it
will just provide the raw audio stream which ensures the greatest level
of compatibility with HTML5 audio players and other client software
which cannot cope with additional data in the stream.\

    All configuration and stream url parameters provided by the
    DNAS during the transition from ICY to HTTP only responses
    have been removed and the DNAS will ignore them if found.

\

[]{#Maximum_Listener_Connection_Limits}

## 7. Maximum Listener Connection Limits [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

There are inherent limits on the maximum number of listener connections
which may be made to a running instances of the DNAS server as can be
set by configuration limits e.g. **\'maxuser\'**, Operating System
limits or bandwidth limits being reached. The first two are easy to
resolve whereas the last (bandwidth limits) is something which will
usually require obtaining additional hosting or paying for more
available bandwidth.

If reaching the Operating System limit, this is usually indicated by the
maximum number of clients never going above a fixed value even if there
is the bandwidth and the server has been configured to go higher, with
the DNAS server reporting a number of errors in its log output. This
usually appears as around \~300 maximum concurrent listener connections
(though this can vary a bit depending on how the listener connections
work).

\
If using a non-Windows Operating System then you can use the **\'ulimit
-n xxxx\'** command to change the upper limit from what is already set
which can be found from just \'ulimit -n\' e.g. to change the limit to
4096 connections you would run **ulimit -n 4096**. The general rule of
thumb is to ensure the limit is set to at least **4 times** the
configured **\'maxuser\'** value.

\
If Windows then there isn\'t any real way to change such things due to
the OS hopefully being configured with limits that will not be reached
when using the DNAS server. If in doubt then consult the Microsoft
support documentation for the OS version being used.

\

[]{#Example_Configurations}

## 8. Example Configurations [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

Included as part of the DNAS server installation are a number of example
configurations to get started with if you prefer to do things directly
instead of using the setup mode ([section 3.4](#Run_in_Setup_Mode)). The
provided examples as found in the **examples** folder are:

sc_serv_basic.conf\
sc_serv_public.conf\
sc_serv_relay.conf\
sc_serv_simple.conf

\
All of the configuration examples are documented and will relate back to
details in this document appropriately. You will need to change some
details e.g. passwords in these example files for the setup you are
making (see [section 3.0](#Getting_Started)). All of the examples are
designed to work from the same install folder as the DNAS server once
they have been copied into the root of the install folder (where
sc_serv\[.exe\] is).

\
Remember if you are not happy with editing text files or find it still
too confusing then you can use the \'**setup**\' mode (see [section
3.4](#Run_in_Setup_Mode)).

\

[]{#sc_serv_basic}

## 8.1. sc_serv_basic [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

This is the base configuration from which the other configuration
examples are based and this will get a DNAS server instance running as a
local setup with no connection made to the Directory to list the stream.

\

[]{#sc_serv_public}

## 8.2. sc_serv_public [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

This configuration file changes the required options in the
sc_serv_basic configuration to get a DNAS server instance running as a
public setup with a connection made to the Directory for listing the
stream. This shows the use of the \'include\' option (see section 4.7)
and how specifying a configuration option twice uses the last value
found.

\

[]{#sc_serv_relay}

## 8.3. sc_serv_relay [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

This configuration file changes the required options in the
sc_serv_public configuration to get a DNAS server instance running as a
public setup with a source coming in from a relay server instead of via
a direct source connection (as used in the other examples).

\

[]{#sc_serv_simple}

## 8.4. sc_serv_simple [\[top\]](#){style="font-size:55%;"}

------------------------------------------------------------------------

\

    Use this if you just need to get a very basic server running or are impatient or
    are struggling to get it running despite the previous example configurations.

This configuration file is designed to be used just as is and is the
simplest form of the configuration file you can have which will allow
you to get a running server to appear on the YP. This works by using the
default settings of the DNAS server though does change some of the file
paths inorder to fit in with the existing setup as used by the other
examples.

\
