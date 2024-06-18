FROM i386/debian:8.9

ARG ROBOT=UR10
ARG SIMULATOR_DIR=/ursimulator
ARG SIMULATOR_DOWNLOAD_URL=https://s3-eu-west-1.amazonaws.com/ur-support-site/222846/URSim_Linux-5.16.1.127999.tar.gz

# The "jessie" debian version is outdated and no longer receives updates.
# To continue using it, we must tell apt to use archive sources and ignore expirations.
# https://unix.stackexchange.com/questions/508724/failed-to-fetch-jessie-backports-repository/508948#508948
COPY config/sources.list /etc/apt/sources.list
COPY config/apt.conf /etc/apt/apt.conf

RUN apt-get update -y &&\
    apt-get install -y --force-yes sudo wget libgcc1 libstdc++6 libc6
RUN ln -s /usr/bin/sudo /usr/bin/pkexec

RUN mkdir -p $SIMULATOR_DIR && mkdir -p /root/Desktop

WORKDIR $SIMULATOR_DIR

RUN echo "Downloading Simulator - $SIMULATOR_DOWNLOAD_URL" && wget -nc $SIMULATOR_DOWNLOAD_URL
RUN export SIMULATOR_FILE=$(basename $SIMULATOR_DOWNLOAD_URL) && tar --strip-components=2 -xvf $SIMULATOR_FILE

# optimize container by not installing dependencies that are not necessary
# to run the controller
RUN sed -i 's/^\s*needToInstallJava$/#needToInstallJava/' install.sh &&\
    sed -i 's/^\s*installDaemonManager$/#installDaemonManager/' install.sh &&\
    sed -i 's/^\s*tty -s$/#tty -s/' install.sh &&\
    sed -i 's/^\s*pushd/#pushd/' install.sh &&\
    sed -i 's/^\s*chmod/#chmod/' install.sh &&\
    sed -i 's/^\s*popd/#popd/' install.sh &&\
    sed -i 's/apt-get -y/apt-get -y --force-yes/g' install.sh

RUN HOME=/root DEBIAN_FRONTEND="noninteractive" ./install.sh

# enables modbus server to be launched by the URControl process
RUN sudo setcap cap_net_bind_service+ep URControl
RUN echo "/opt/urtool-3.0/lib/" > /etc/ld.so.conf.d/77urcontrol.conf
RUN ldconfig

RUN mv .urcontrol/urcontrol.conf.$ROBOT .urcontrol/urcontrol.conf
COPY safety.conf .urcontrol/safety.conf

RUN echo "LD_LIBRARY_PATH=/opt/urtool-3.0/lib HOME=/ursimulator /ursimulator/./URControl -r | tee /ursimulator/URControl.log" > run-controller.sh
RUN chmod a+x run-controller.sh

EXPOSE 30001
EXPOSE 30002
EXPOSE 30003
EXPOSE 30004

ENTRYPOINT ["/bin/bash", "-c", "/ursimulator/run-controller.sh"]